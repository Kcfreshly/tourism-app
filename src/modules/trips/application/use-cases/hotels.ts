import { AppError } from "@/shared/application/app-error";
import { matchHotels, type HotelInput } from "../../domain/hotels";
import type { Profile, StayType } from "../../domain/profile";
import type { HotelRepository } from "../ports/hotel-repository";

// Travellers: the closest places on our list to what they typed.
export class SearchHotels {
  constructor(private readonly hotels: HotelRepository) {}

  async execute(query: {
    q: string;
    zoneId?: Profile["zoneId"];
    type?: StayType;
  }) {
    if (!query.q.trim()) return [];
    return matchHotels(
      await this.hotels.list(),
      query.q,
      query.zoneId,
      query.type,
    );
  }
}

// Staff: the whole list, to add to and correct.
export class ListHotels {
  constructor(private readonly hotels: HotelRepository) {}

  execute() {
    return this.hotels.list();
  }
}

export class SaveHotel {
  constructor(private readonly hotels: HotelRepository) {}

  async execute(
    actorId: string,
    input:
      | { hotel: HotelInput }
      | { id: string; expectedVersion: number; hotel: HotelInput },
  ) {
    if (!("id" in input))
      return this.hotels.create(
        { id: crypto.randomUUID(), ...input.hotel },
        actorId,
      );
    const saved = await this.hotels.update(
      input.id,
      input.expectedVersion,
      input.hotel,
      actorId,
    );
    if (!saved)
      throw new AppError(
        "CONFLICT",
        "VERSION_CONFLICT",
        "This hotel changed since you opened it. Reload the list.",
      );
    return saved;
  }
}
