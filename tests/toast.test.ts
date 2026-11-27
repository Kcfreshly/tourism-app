import { describe, expect, it } from "vitest";
import { destinationLabel } from "@/components/toast";

describe("destinationLabel", () => {
  it.each([
    ["/", "the home page"],
    ["/explore", "things to do"],
    ["/packages", "ready-made trips"],
    ["/packages/lagos-weekend", "the trip"],
    ["/experiences/lekki-canopy-walk", "the experience"],
    ["/destinations/lagos", "Lagos"],
    ["/plan/new", "the planner"],
    ["/trips/abc/plan", "your plan"],
    ["/trips/abc/checkout", "trip checkout"],
    ["/checkout/return", "your payment"],
    ["/bookings/FL-123", "your booking"],
    ["/somewhere-new", "the next page"],
  ])("names %s as %s", (path, label) => {
    expect(destinationLabel(path)).toBe(label);
  });
});
