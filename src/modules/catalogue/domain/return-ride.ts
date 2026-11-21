// How reliably a traveller can get a ride back from a listing. The reviewer
// sets it from the onboarding framework's logistics, accessibility and
// emergency checks ("can we get them there and back?").
export const returnRides = ["EASY", "PRE_BOOK", "DRIVER_REQUIRED"] as const;
export type ReturnRide = (typeof returnRides)[number];

export const returnRideLabels: Record<ReturnRide, string> = {
  EASY: "Easy: cars are easy to find there",
  PRE_BOOK: "Pre-book: book the ride back in advance",
  DRIVER_REQUIRED: "Driver required: car for the day only",
};

// Sample ratings for the demo catalogue; real listings carry their own.
const demoRatings: Record<string, ReturnRide> = {
  "nature-walk": "EASY",
  gallery: "EASY",
  gardens: "EASY",
  games: "EASY",
  cooking: "EASY",
  makers: "EASY",
  beach: "PRE_BOOK",
  "local-market": "PRE_BOOK",
  neighbourhood: "PRE_BOOK",
  suya: "PRE_BOOK",
  music: "PRE_BOOK",
  history: "DRIVER_REQUIRED",
};

// Unrated listings are treated as pre-book: never promise an easy ride back
// that nobody has checked.
export function returnRideFor(e: {
  id: string;
  seedKey?: string;
  returnRide?: ReturnRide;
}) {
  return e.returnRide ?? demoRatings[e.seedKey ?? e.id] ?? "PRE_BOOK";
}
