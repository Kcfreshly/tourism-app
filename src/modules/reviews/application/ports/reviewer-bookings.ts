import type { ReviewableBooking } from "../../domain/review";

// What reviews need from the bookings module (payments plan): a traveller's
// paid bookings for one listing, with their status. The use cases decide
// which of them make the traveller eligible.
export interface ReviewerBookings {
  forListing(userId: string, productId: string): Promise<ReviewableBooking[]>;
}
