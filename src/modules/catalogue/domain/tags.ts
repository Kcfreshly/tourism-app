// The fixed tag vocabulary for activities and ready-made trips. Staff pick
// from this list so the same idea is never spelled two ways; add a tag here
// (with its label and group) before using it.
export const tagGroups = [
  {
    label: "Who it suits",
    tags: {
      family: "Family friendly",
      couples: "Couples",
      groups: "Groups",
      solo: "Solo travellers",
      business: "Business travellers",
    },
  },
  {
    label: "Style",
    tags: {
      hosted: "Hosted",
      "hands-on": "Hands-on",
      relaxed: "Relaxed pace",
      adventure: "Adventure",
      premium: "Premium",
      budget: "Budget friendly",
    },
  },
  {
    label: "Theme",
    tags: {
      music: "Music",
      art: "Art & design",
      history: "History & heritage",
      nature: "Nature",
      beach: "Beach",
      food: "Food & drink",
      wildlife: "Wildlife",
      mountains: "Mountains & hills",
    },
  },
  {
    label: "Occasion",
    tags: {
      event: "Event",
      festival: "Festival",
      evening: "Evening",
      weekend: "Weekend",
      "rainy-day": "Rainy day",
      "road-trip": "Road trip",
    },
  },
] as const;

// Every tag id across the groups.
type TagsOf<G> = G extends { tags: infer T } ? keyof T & string : never;
export type Tag = TagsOf<(typeof tagGroups)[number]>;

export const tagLabels: Record<string, string> = Object.assign(
  {},
  ...tagGroups.map((g) => g.tags),
);

export const tagIds = Object.keys(tagLabels) as [Tag, ...Tag[]];

export function isTag(value: string): value is Tag {
  return value in tagLabels;
}

// Drops tags that are no longer in the vocabulary, keeping order.
export function knownTags(values: readonly string[] | undefined): Tag[] {
  return [...new Set(values ?? [])].filter(isTag);
}
