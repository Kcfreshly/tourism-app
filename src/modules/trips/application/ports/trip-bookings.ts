// What trips need from the bookings module: whether a trip has been paid
// for, and the order reference to show and link to.
export interface TripBookings {
  orderFor(tripId: string): Promise<string | null>;
  ordersFor(tripIds: string[]): Promise<Map<string, string>>;
}

// For callers that don't wire bookings, such as module scripts.
export const noTripBookings: TripBookings = {
  orderFor: async () => null,
  ordersFor: async () => new Map(),
};
