// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import fixture from "../tourism-v1-handoff/data/experiences.demo.json";
import AdminCatalogue from "../src/components/admin-catalogue";

const market = fixture.experiences.find((e) => e.id === "local-market")!;
const row = {
  id: "7f0c2a6e-1d1b-4b9a-9a39-3a4d2c6b8e10",
  seedKey: "local-market",
  status: "DEMO_PUBLISHED",
  version: 4,
  record: market,
  review: {
    content: true,
    rates: true,
    capacity: true,
    policy: true,
    media: true,
  },
};

const draft = {
  ...row,
  id: "1b9e6a8e-3c1d-4c51-9f00-7d0c9a2b5e21",
  seedKey: "demo-draft",
  status: "DRAFT",
  version: 1,
  record: {
    ...market,
    id: "demo-draft",
    name: "Rooftop jazz brunch — DEMO",
    story: {
      teaser: "Live jazz and brunch above the lagoon.",
      summary: "A long Sunday brunch on a rooftop with a live jazz trio.",
      why: "",
    },
    details: {
      operator: "Rooftop Sessions (sample partner)",
      venue: "Rooftop terrace, Victoria Island",
      arrival: "SELF",
      pickupRateMinor: 0,
      childRateMinor: 0,
      confirmation: "INSTANT",
      partnerHours: 0,
      freeCancellationHours: 48,
    },
  },
  review: null,
};

// A fake /api/v1/admin/catalogue that echoes saved records back.
const patches: Record<string, unknown>[] = [];
const calls: { url: string; method: string; body?: unknown }[] = [];
const gone = {
  auditId: "4a5b6c7d-8e9f-4a0b-9c1d-2e3f4a5b6c7d",
  id: "6e5d4c3b-2a19-4f08-8e7d-6c5b4a392817",
  name: "Old boat cruise — DEMO",
  deletedAt: "2026-11-20T10:00:00Z",
  deletedBy: "Ada (super admin)",
  reason: "Supplier stopped",
};
beforeEach(() => {
  patches.length = 0;
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({
        url,
        method,
        body:
          typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
      });
      if (url.endsWith("/catalogue/deleted"))
        return method === "POST"
          ? Response.json(
              {
                data: {
                  ...row,
                  id: gone.id,
                  seedKey: "boat",
                  record: { ...market, name: gone.name },
                },
              },
              { status: 201 },
            )
          : Response.json({ data: [gone] });
      if (url.startsWith("/api/v1/admin/catalogue/history"))
        return Response.json({
          data: [
            {
              id: "e1",
              action: "DEMO_CATALOGUE_UPDATED",
              actorId: "u1",
              actorName: "Ada",
              createdAt: "2026-11-21T09:00:00Z",
              version: 4,
              status: "DEMO_PUBLISHED",
              details: { changed: ["offer.rateMinor"] },
            },
          ],
        });
      if (url === "/api/v1/admin/media")
        return Response.json(
          {
            data: {
              id: "8c7b6a59-4837-4261-9504-a3b2c1d0e9f8",
              url: "/api/v1/media/8c7b6a59-4837-4261-9504-a3b2c1d0e9f8",
            },
          },
          { status: 201 },
        );
      if (method === "DELETE")
        return Response.json({ data: { deleted: true } });
      if (init?.method === "PATCH") {
        const edit = JSON.parse(String(init.body));
        patches.push(edit);
        return Response.json({
          data: {
            ...(edit.id === draft.id ? draft : row),
            status: edit.status,
            review: edit.review,
            version: edit.expectedVersion + 1,
            record: {
              ...market,
              story: edit.story,
              details: edit.details,
              tags: edit.tags,
              offer: { ...market.offer, rateMinor: edit.rateMinor },
            },
          },
        });
      }
      return Response.json({ data: [row, draft] });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function openMarket() {
  render(<AdminCatalogue />);
  fireEvent.click(await screen.findByRole("button", { name: /Market life/ }));
}

describe("listings admin panel", () => {
  it("starts from what travellers see, including sample copy and terms", async () => {
    await openMarket();
    fireEvent.click(screen.getByRole("button", { name: "Story" }));
    expect((screen.getByLabelText(/Teaser/) as HTMLInputElement).value).toMatch(
      /busy market/,
    );
    fireEvent.click(screen.getByRole("button", { name: "Logistics & terms" }));
    expect(
      (screen.getByLabelText(/Confirmation/) as HTMLSelectElement).value,
    ).toBe("PARTNER");
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save changes",
      }).disabled,
    ).toBe(true);
  });

  it("saves edited copy and prices with the full listing payload", async () => {
    await openMarket();
    fireEvent.click(screen.getByRole("button", { name: "Pricing & party" }));
    fireEvent.change(screen.getByLabelText(/^Rate/), {
      target: { value: "18000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Story" }));
    fireEvent.change(screen.getByLabelText(/Teaser/), {
      target: { value: "Fabric lanes and spice stalls with a host." },
    });
    expect(screen.getByText(/Unsaved changes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({
      expectedVersion: 4,
      rateMinor: 1800000,
      story: { teaser: "Fabric lanes and spice stalls with a host." },
      details: { confirmation: "PARTNER", partnerHours: 24 },
      minAge: 12,
    });
    expect(await screen.findByText(/Saved version 5/)).toBeTruthy();
  });

  it("saves a published listing whose review was never recorded", async () => {
    // Seeded demo rows are published without a ticked checklist.
    const ticked = row.review;
    row.review = {
      content: false,
      rates: false,
      capacity: false,
      policy: false,
      media: false,
    };
    try {
      await openMarket();
      fireEvent.click(screen.getByRole("button", { name: "Pricing & party" }));
      fireEvent.change(screen.getByLabelText(/^Rate/), {
        target: { value: "19000" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(patches).toHaveLength(1));
      expect(patches[0]).toMatchObject({
        status: "DEMO_PUBLISHED",
        review: ticked,
      });
    } finally {
      row.review = ticked;
    }
  });

  it("explains invalid values instead of sending them", async () => {
    await openMarket();
    fireEvent.click(screen.getByRole("button", { name: "Pricing & party" }));
    fireEvent.change(screen.getByLabelText(/Minimum party/), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText(/Maximum party/), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/Maximum party/)).toBeTruthy();
    expect(patches).toHaveLength(0);
  });

  it("adds tags from the fixed list only", async () => {
    await openMarket();
    fireEvent.change(screen.getByLabelText("Add a tag"), {
      target: { value: "family" },
    });
    expect(
      screen.getByRole("button", { name: "Remove Family friendly" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0].tags).toContain("family");
  });

  it("publishes a draft in one click, recording the staff approval", async () => {
    render(<AdminCatalogue />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Rooftop jazz/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({
      status: "DEMO_PUBLISHED",
      review: {
        content: true,
        rates: true,
        capacity: true,
        policy: true,
        media: true,
      },
    });
    expect(
      await screen.findByText(/Published\. Travellers can see it now/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeTruthy();
  });

  it("says what is missing instead of publishing an unready draft", async () => {
    render(<AdminCatalogue />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Rooftop jazz/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Pricing & party" }));
    fireEvent.change(screen.getByLabelText(/^Rate/), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Set a price above ₦0")).toBeTruthy();
    expect(patches).toHaveLength(0);
  });

  it("uploads photos and makes the chosen one primary", async () => {
    await openMarket();
    fireEvent.click(screen.getByRole("button", { name: "Photos & event" }));
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "hall.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(screen.getByLabelText("Add photos"), {
      target: { files: [file] },
    });
    expect(await screen.findByText("Primary")).toBeTruthy();
    const upload = calls.find((c) => c.url === "/api/v1/admin/media")!;
    expect(upload.method).toBe("POST");
    expect((upload.body as FormData).get("file")).toBeInstanceOf(File);
    fireEvent.change(screen.getByLabelText("Describe the photo"), {
      target: { value: "Market lane at noon" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0].images).toEqual([
      {
        id: "8c7b6a59-4837-4261-9504-a3b2c1d0e9f8",
        alt: "Market lane at noon",
      },
    ]);
  });

  it("shows read-only history from the audit trail", async () => {
    await openMarket();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByText("Changed: offer.rateMinor")).toBeTruthy();
    expect(screen.getByText(/Nobody can edit or remove/)).toBeTruthy();
  });

  it("offers delete to super admins only", async () => {
    await openMarket();
    fireEvent.click(screen.getByRole("button", { name: "Publishing" }));
    expect(screen.queryByRole("button", { name: "Delete listing" })).toBeNull();
    cleanup();
    vi.stubGlobal("confirm", () => true);
    render(<AdminCatalogue canDelete />);
    fireEvent.click(await screen.findByRole("button", { name: /Market life/ }));
    fireEvent.click(screen.getByRole("button", { name: "Publishing" }));
    fireEvent.change(screen.getByLabelText("Reason (optional)"), {
      target: { value: "Duplicate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    await screen.findByText(/Deleted\. Restore it/);
    expect(calls.find((c) => c.method === "DELETE")?.body).toEqual({
      id: row.id,
      expectedVersion: 4,
      reason: "Duplicate",
    });
    expect(screen.queryByRole("button", { name: /Market life/ })).toBeNull();
  });

  it("restores a deleted listing from the audit trail", async () => {
    render(<AdminCatalogue />);
    fireEvent.click(await screen.findByText("Recently deleted (1)"));
    expect(screen.getByText(/Deleted by Ada \(super admin\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(
      await screen.findByRole("button", { name: /Old boat cruise/ }),
    ).toBeTruthy();
    expect(
      calls.find((c) => c.url.endsWith("/deleted") && c.method === "POST")
        ?.body,
    ).toEqual({ auditId: gone.auditId });
  });
});
