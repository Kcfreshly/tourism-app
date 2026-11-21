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

// A fake /api/v1/admin/catalogue that echoes saved records back.
const patches: Record<string, unknown>[] = [];
beforeEach(() => {
  patches.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        const edit = JSON.parse(String(init.body));
        patches.push(edit);
        return Response.json({
          data: {
            ...row,
            version: 5,
            record: {
              ...market,
              story: edit.story,
              details: edit.details,
              offer: { ...market.offer, rateMinor: edit.rateMinor },
            },
          },
        });
      }
      return Response.json({ data: [row] });
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
        name: "Save audited changes",
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
    fireEvent.click(
      screen.getByRole("button", { name: "Save audited changes" }),
    );
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

  it("explains invalid values instead of sending them", async () => {
    await openMarket();
    fireEvent.click(screen.getByRole("button", { name: "Pricing & party" }));
    fireEvent.change(screen.getByLabelText(/Minimum party/), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText(/Maximum party/), {
      target: { value: "2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save audited changes" }),
    );
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/Maximum party/)).toBeTruthy();
    expect(patches).toHaveLength(0);
  });
});
