import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/database/schema";
import type { Database } from "../src/database/client";
import { sqlStatements } from "../src/database/sql-statements";
import { DrizzleCatalogueRepository } from "../src/modules/catalogue/infrastructure/persistence/drizzle-catalogue-repository";
import { DrizzleMediaRepository } from "../src/modules/catalogue/infrastructure/persistence/drizzle-media-repository";
import { DeleteCatalogueRecord } from "../src/modules/catalogue/application/use-cases/delete-catalogue-record";
import { RestoreCatalogueRecord } from "../src/modules/catalogue/application/use-cases/restore-catalogue-record";
import { ListDeletedListings } from "../src/modules/catalogue/application/use-cases/list-deleted-listings";
import { ListCatalogueHistory } from "../src/modules/catalogue/application/use-cases/list-catalogue-history";
import { UploadImage } from "../src/modules/catalogue/application/use-cases/upload-image";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";

// A fresh in-memory database with every migration applied, as npm run
// db:migrate does.
const pg = new PGlite();
const db = drizzle(pg, { schema, casing: "snake_case" }) as unknown as Database;
const repo = new DrizzleCatalogueRepository(() => db);
const gallery = fixture.experiences.find((e) => e.id === "gallery")!;
const id = "3f2b6d1e-9a4c-4e8b-b1d2-6c7a8e9f0a1b";

beforeAll(async () => {
  for (const file of readdirSync("migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    for (const statement of sqlStatements(
      readFileSync(`migrations/${file}`, "utf8"),
    ))
      await pg.exec(statement);
  await repo.createDraft(
    {
      id,
      seedKey: "gallery",
      status: "DEMO_PUBLISHED",
      record: gallery,
      review: {},
    },
    { actorId: "staff-1", action: "DEMO_CATALOGUE_DRAFT_CREATED", details: {} },
  );
});

async function events() {
  return (
    await pg.query<{
      action: string;
      details: { snapshot?: { version: number } };
    }>(
      "SELECT action, details FROM audit_events WHERE entity_id = $1 ORDER BY created_at, action",
      [id],
    )
  ).rows;
}

describe("audit trail and recovery", () => {
  it("keeps a full snapshot with every save", async () => {
    await repo.update({ id, expectedVersion: 1, actorId: "staff-1" }, () => ({
      status: "DEMO_PUBLISHED",
      record: { ...gallery, name: "Gallery afternoon — DEMO" },
      review: {},
      audit: {
        action: "DEMO_CATALOGUE_UPDATED",
        details: { changed: ["name"] },
      },
    }));
    const saved = await events();
    expect(saved.map((e) => e.details.snapshot?.version)).toEqual([1, 2]);
  });

  it("lets nobody change or remove audit events, or drop the table", async () => {
    for (const statement of [
      "UPDATE audit_events SET action = 'X'",
      "DELETE FROM audit_events",
      "TRUNCATE audit_events",
      "DROP TABLE audit_events",
      "ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_change",
    ])
      await expect(pg.exec(statement)).rejects.toThrow(/audit_events is/);
    expect((await events()).length).toBe(2);
  });

  it("deletes into the audit trail and restores from it", async () => {
    const remove = new DeleteCatalogueRecord(repo);
    await expect(
      remove.execute({
        actorId: "super-1",
        id,
        expectedVersion: 1,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    await remove.execute({
      actorId: "super-1",
      id,
      expectedVersion: 2,
      reason: "Duplicate listing",
    });
    expect((await repo.listAll()).length).toBe(0);

    const [gone] = await new ListDeletedListings(repo).execute();
    expect(gone).toMatchObject({
      id,
      seedKey: "gallery",
      name: "Gallery afternoon — DEMO",
      reason: "Duplicate listing",
      deletedBy: "super-1",
    });

    const restore = new RestoreCatalogueRecord(repo);
    const back = await restore.execute({
      actorId: "staff-2",
      auditId: gone.auditId,
    });
    expect(back).toMatchObject({
      id,
      seedKey: "gallery",
      status: "DEMO_PUBLISHED",
      version: 3,
    });
    expect((back.record as { name: string }).name).toBe(
      "Gallery afternoon — DEMO",
    );
    expect(await new ListDeletedListings(repo).execute()).toEqual([]);
    await expect(
      restore.execute({ actorId: "staff-2", auditId: gone.auditId }),
    ).rejects.toMatchObject({ code: "ALREADY_LISTED" });

    const history = await new ListCatalogueHistory(repo).execute(id);
    expect(history.map((e) => e.action)).toEqual([
      "CATALOGUE_RESTORED",
      "CATALOGUE_DELETED",
      "DEMO_CATALOGUE_UPDATED",
      "DEMO_CATALOGUE_DRAFT_CREATED",
    ]);
    // Snapshots stay on the server; history only says which version.
    expect(history[0]).not.toHaveProperty("details.snapshot");
    expect(history[0].version).toBe(3);
  });

  it("stores uploaded photos once and serves the same bytes", async () => {
    const media = new DrizzleMediaRepository(() => db);
    const upload = new UploadImage(media);
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
    ]);
    const a = await upload.execute({ actorId: "staff-1", data: png });
    const b = await upload.execute({ actorId: "staff-1", data: png });
    expect(b.id).toBe(a.id);
    const stored = await media.find(a.id);
    expect(stored?.contentType).toBe("image/png");
    expect([...stored!.data]).toEqual([...png]);
    await expect(
      upload.execute({
        actorId: "staff-1",
        data: new TextEncoder().encode("<svg/>"),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_IMAGE" });
  });
});
