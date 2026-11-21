// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import AdminTransportSettings from "../src/components/admin-transport-settings";
import { defaultTransportSettings } from "../src/modules/trips/domain/transport-settings";

// A fake /api/v1/admin/transport-settings that stores what is saved.
const saves: { expectedVersion: number; settings: unknown }[] = [];
beforeEach(() => {
  saves.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        saves.push(body);
        return Response.json({
          data: { settings: body.settings, version: body.expectedVersion + 1 },
        });
      }
      return Response.json({
        data: { settings: defaultTransportSettings, version: 0 },
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("transport settings admin", () => {
  it("edits car blocks and the night car, then saves with the version", async () => {
    render(<AdminTransportSettings />);
    expect(
      await screen.findByText(/Using the default demo settings/),
    ).toBeTruthy();
    const save = screen.getByRole("button", {
      name: "Save transport settings",
    }) as HTMLButtonElement;
    // Nothing to save until something changes.
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Block 1 price per car"), {
      target: { value: "32000" },
    });
    fireEvent.change(screen.getByLabelText("Night car price per car (₦)"), {
      target: { value: "42000" },
    });
    fireEvent.click(save);
    await waitFor(() => expect(saves).toHaveLength(1));
    expect(saves[0].expectedVersion).toBe(0);
    expect(saves[0].settings).toMatchObject({
      dayBlocks: [
        { hours: 4, rateMinor: 3200000 },
        ...defaultTransportSettings.dayBlocks.slice(1),
      ],
      night: { ...defaultTransportSettings.night, rateMinor: 4200000 },
    });
    expect(await screen.findByText(/Version 1 applies/)).toBeTruthy();
  });

  it("won't save blocks that aren't shortest first", async () => {
    render(<AdminTransportSettings />);
    fireEvent.change(await screen.findByLabelText("Block 2 hours"), {
      target: { value: "3" },
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "shortest to longest",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Save transport settings",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
