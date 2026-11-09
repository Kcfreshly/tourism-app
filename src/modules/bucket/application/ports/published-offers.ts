// What the bucket needs from the catalogue module: which offers are live.
export interface PublishedOffers {
  ids(): Promise<Set<string>>;
}
