import type { Bookable } from "../../domain/resolve-line";

// What bookings need from the catalogue and partners modules: everything
// that can be sold right now. Published listings and trips only, and only
// those run by Fastlife or by a verified partner.
export interface BookableCatalogue {
  load(): Promise<Bookable[]>;
}
