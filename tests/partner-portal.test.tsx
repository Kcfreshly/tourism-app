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
import PartnerListings from "../src/components/partner-listings";
import PartnerDashboard from "../src/components/partner-dashboard";
import AdminPartners from "../src/components/admin-partners";
import AdminPartnerInvites from "../src/components/admin-partner-invites";

const market = fixture.experiences.find((e) => e.id === "local-market")!;
const draftId = "1b9e6a8e-3c1d-4c51-9f00-7d0c9a2b5e21";
const submission = {
  id: draftId,
  productType: "EXPERIENCE",
  productId: null,
  name: "Lagoon kayak morning — DEMO",
  proposed: {
    ...market,
    name: "Lagoon kayak morning — DEMO",
    details: {
      operator: "Lagoon Paddlers",
      venue: "Jetty 3, Lekki Phase 1",
      arrival: "SELF",
      pickupRateMinor: 0,
      childRateMinor: 0,
      confirmation: "PARTNER",
      partnerHours: 24,
      freeCancellationHours: 48,
    },
  },
  status: "DRAFT",
  reason: "Add the jetty number",
  version: 2,
  updatedAt: "2026-11-21T10:00:00Z",
};

const calls: { url: string; method: string; body?: Record<string, unknown> }[] =
  [];
function respond(data: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => ({ data }) };
}
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      if (url === "/api/v1/partner/listings")
        return respond([
          {
            productType: "EXPERIENCE",
            productId: null,
            name: submission.name,
            live: null,
            submission,
          },
        ]);
      if (url === "/api/v1/partner/submissions" && method === "PATCH")
        return respond({
          ...submission,
          status: body.submit ? "PENDING" : "DRAFT",
          reason: body.submit ? null : submission.reason,
          version: submission.version + 1,
        });
      if (url === "/api/v1/partner/dashboard")
        return respond({
          period: { from: "2026-10-24", to: "2026-11-22", days: 30 },
          totals: {
            views: 12,
            viewsBefore: 6,
            visitors: 9,
            visitorsBefore: 0,
            saves: 3,
            tripPlans: 2,
            live: 1,
            inReview: 1,
            changesRequested: 0,
            drafts: 0,
          },
          daily: [{ day: "2026-11-22", views: 12 }],
          listings: [
            {
              productType: "EXPERIENCE",
              productId: "x",
              name: "Lagoon kayak morning — DEMO",
              status: "DEMO_PUBLISHED",
              slug: "partner-x",
              views: 12,
              visitors: 9,
              saves: 3,
              tripPlans: 2,
            },
          ],
          sales: null,
        });
      if (url === "/api/v1/admin/submissions" && method === "GET")
        return respond([
          {
            ...submission,
            status: "PENDING",
            businessName: "Lagoon Paddlers",
            partnerId: "p1",
            submittedAt: "2026-11-21T10:00:00Z",
            live: null,
          },
        ]);
      if (url === "/api/v1/admin/partners" && method === "GET")
        return respond([
          {
            id: "2c4e6a8b-0d1f-4a3b-8c5d-7e9f0a1b2c3d",
            businessName: "Obudu Escapes",
            contactEmail: "trips@obudu.example",
            phone: "+234 801 000 0000",
            offering: "Three-day trips to Obudu every month",
            status: "PENDING",
            decisionReason: null,
            version: 1,
            createdAt: "2026-11-20T10:00:00Z",
          },
        ]);
      if (url === "/api/v1/admin/partner-invites" && method === "GET")
        return respond([]);
      if (url === "/api/v1/admin/partner-invites" && method === "POST")
        return respond(
          {
            invite: {
              ...body,
              id: "9b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d",
              status: "OPEN",
              createdAt: "2026-11-26T10:00:00Z",
              expiresAt: "2026-12-10T10:00:00Z",
            },
            url: "http://app.test/partner/invite/abc123",
          },
          201,
        );
      if (method === "PATCH") return respond({ ...body, status: "VERIFIED" });
      return respond(null, 404);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("partner portal", () => {
  it("shows staff feedback and submits a draft for review", async () => {
    render(<PartnerListings />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Lagoon kayak morning/ }),
    );
    expect(screen.getByText("Add the jetty number")).toBeTruthy();
    // Staff-only controls are not offered to partners.
    expect(screen.queryByRole("button", { name: "History" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Ready to submit?")).toBeTruthy();
    expect(screen.queryByText(/Other statuses/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    await screen.findByText(/Submitted\. Fastlife will review it/);
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body).toMatchObject({
      id: draftId,
      expectedVersion: 2,
      submit: true,
    });
    expect(patch.body?.experience).toBeDefined();
    expect(screen.getByText(/In review\./)).toBeTruthy();
  });

  it("shows views, visitors and interest, and says sales start with payments", async () => {
    render(<PartnerDashboard onOpenListings={() => {}} />);
    const stats = await screen.findByRole("list", { name: "Key figures" });
    expect(within(stats).getByText("12")).toBeTruthy();
    expect(within(stats).getByText(/▲ 100%/)).toBeTruthy();
    expect(
      within(stats).getAllByText(/Starts when online payment/),
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /Lagoon kayak morning/ }),
    ).toBeTruthy();
  });
});

describe("staff review of partners", () => {
  it("needs a reason to send back, and approves submissions", async () => {
    render(<AdminPartners />);
    const review = (
      await screen.findByRole("heading", {
        name: /Lagoon kayak morning/,
      })
    ).closest("li")!;
    const back = within(review).getByRole("button", { name: "Send back" });
    expect((back as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(
      within(review).getByRole("button", { name: "Approve & publish" }),
    );
    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.url === "/api/v1/admin/submissions" && c.method === "PATCH",
        )?.body,
      ).toMatchObject({ id: draftId, expectedVersion: 2, decision: "APPROVE" }),
    );
  });

  it("verifies a partner application", async () => {
    render(<AdminPartners />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Verify partner" }),
    );
    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.url === "/api/v1/admin/partners" && c.method === "PATCH",
        )?.body,
      ).toMatchObject({ status: "VERIFIED", expectedVersion: 1 }),
    );
  });
});

describe("partner invitations in admin", () => {
  it("checks the details, then shows the link once to send", async () => {
    render(<AdminPartnerInvites />);
    await screen.findByText("No invitations yet.");
    fireEvent.click(screen.getByRole("button", { name: "Invite a partner" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Create invitation link" }),
    );
    expect(screen.getByRole("alert").textContent).toMatch(/what you run/i);
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    fireEvent.change(screen.getByLabelText("Business name"), {
      target: { value: "Obudu Escapes" },
    });
    fireEvent.change(screen.getByLabelText("Contact email"), {
      target: { value: "trips@obudu.example" },
    });
    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: "+234 802 000 0000" },
    });
    fireEvent.change(screen.getByLabelText("What they run"), {
      target: { value: "Three-day trips to Obudu every month" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Create invitation link" }),
    );
    const link = (await screen.findByLabelText(
      "Invitation link",
    )) as HTMLInputElement;
    expect(link.value).toBe("http://app.test/partner/invite/abc123");
    expect(screen.getByText("Send this link to Obudu Escapes")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Cancel invitation" }),
    ).toBeTruthy();
  });
});
