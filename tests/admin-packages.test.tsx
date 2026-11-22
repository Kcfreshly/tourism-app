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
import AdminPackages from "../src/components/admin-packages";
import {
  demoPackages,
  draftPackage,
  type PackageRecord,
} from "../src/modules/catalogue/domain/packages";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Record<string, unknown>) => (
    <a href={String(href)} {...rest}>
      {children as React.ReactNode}
    </a>
  ),
}));

const published: PackageRecord = {
  id: "5d1f0c1e-8a3b-4c2d-9e4f-0a1b2c3d4e5f",
  slug: "badagry-coast-escape",
  status: "DEMO_PUBLISHED",
  version: 2,
  record: demoPackages.find((p) => p.slug === "badagry-coast-escape")!,
};
const created: PackageRecord = {
  id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  slug: "3-days-in-obudu",
  status: "DRAFT",
  version: 1,
  record: draftPackage("3-days-in-obudu", "3 days in Obudu"),
};

// A fake /api/v1/admin/packages that stores what is created and saved.
const sent: { method: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (init?.method) sent.push({ method: init.method, body });
      if (init?.method === "POST")
        return Response.json({ data: created }, { status: 201 });
      if (init?.method === "PATCH")
        return Response.json({
          data: {
            ...(body.id === created.id ? created : published),
            status: body.status,
            version: body.expectedVersion + 1,
            record: body.trip,
          },
        });
      return Response.json({ data: [published] });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function createObudu() {
  render(<AdminPackages />);
  await screen.findByRole("button", { name: /Badagry/ });
  fireEvent.change(screen.getByLabelText("Trip title"), {
    target: { value: "3 days in Obudu" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
  await screen.findByText(/Draft created/);
}

describe("ready-made trips admin", () => {
  it("creates a draft and lists what it needs before publishing", async () => {
    await createObudu();
    expect(sent[0]).toEqual({
      method: "POST",
      body: { title: "3 days in Obudu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Name the operator")).toBeTruthy();
    expect(sent).toHaveLength(1);
  });

  it("builds the route, departures and price, then publishes", async () => {
    await createObudu();
    fireEvent.change(screen.getByLabelText(/^Summary/), {
      target: { value: "Three cool days on the Obudu plateau." },
    });
    fireEvent.change(screen.getByLabelText(/^Operator/), {
      target: { value: "Highland Tours" },
    });
    fireEvent.change(screen.getByLabelText("Add a tag"), {
      target: { value: "mountains" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Route" }));
    const places = screen.getAllByLabelText("Place");
    const plans = screen.getAllByLabelText("Plan for the day");
    ["Calabar → Obudu", "Obudu", "Obudu → Calabar"].forEach((place, i) => {
      fireEvent.change(places[i], { target: { value: place } });
      fireEvent.change(plans[i], { target: { value: `Day ${i + 1} plan` } });
    });

    fireEvent.click(screen.getByRole("button", { name: "Departures" }));
    fireEvent.click(screen.getByRole("button", { name: "Add departure" }));

    fireEvent.click(screen.getByRole("button", { name: "Pricing" }));
    fireEvent.change(screen.getByLabelText(/^Price \(₦\)/), {
      target: { value: "250000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Terms & publish" }));
    fireEvent.change(screen.getByLabelText(/Booking terms/), {
      target: { value: "Pay in full to book.\n\nFull refund up to 14 days." },
    });
    expect(
      screen.getByText("Everything travellers need is filled in."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Save & publish" }));
    await screen.findByText(/Published\. Travellers can see and book it now/);
    const patch = sent.find((s) => s.method === "PATCH")!.body as {
      status: string;
      trip: Record<string, unknown>;
    };
    expect(patch.status).toBe("DEMO_PUBLISHED");
    expect(patch.trip).toMatchObject({
      operator: "Highland Tours",
      priceMinor: 25000000,
      tags: ["mountains"],
      bookingTerms: ["Pay in full to book.", "Full refund up to 14 days."],
    });
    expect((patch.trip.route as { day: number }[]).map((r) => r.day)).toEqual([
      1, 2, 3,
    ]);
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeTruthy();
  });

  it("unpublishes a live trip", async () => {
    render(<AdminPackages />);
    fireEvent.click(await screen.findByRole("button", { name: /Badagry/ }));
    expect(screen.getByRole("link", { name: "View live trip" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    await waitFor(() =>
      expect(sent).toEqual([
        expect.objectContaining({
          method: "PATCH",
          body: expect.objectContaining({ status: "PAUSED" }),
        }),
      ]),
    );
    expect(await screen.findByText(/Unpublished\. Hidden/)).toBeTruthy();
  });
});
