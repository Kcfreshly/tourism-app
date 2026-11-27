import type { Hotel, HotelInput } from "../../domain/hotels";

export interface HotelRepository {
  // Every hotel, active or not, by name.
  list(): Promise<Hotel[]>;
  // Each writes an audit event in the same transaction.
  create(hotel: HotelInput & { id: string }, actorId: string): Promise<Hotel>;
  // Only at that version; null when someone else saved first.
  update(
    id: string,
    expectedVersion: number,
    hotel: HotelInput,
    actorId: string,
  ): Promise<Hotel | null>;
}
