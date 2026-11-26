import { AppError } from "@/shared/application/app-error";

// Refuses a change to a trip that has been paid for.
export function tripBooked(orderReference: string) {
  return new AppError(
    "CONFLICT",
    "TRIP_BOOKED",
    `This trip is booked (${orderReference}), so its days and services can’t change here. Contact Fastlife from your booking to change it.`,
    { orderReference },
  );
}

export function assertNotBooked(context: {
  booking: { orderReference: string } | null;
}) {
  if (context.booking) throw tripBooked(context.booking.orderReference);
}
