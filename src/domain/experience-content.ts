// Customer-facing presentation for catalogue records. The catalogue remains the
// source of truth for prices, hours, sessions and capacity; this module only
// supplies readable labels and sample copy for the fictional demo listings.

export const zoneLabels: Record<string, string> = {
  LEKKI: "Lekki",
  VI: "Victoria Island",
  MAINLAND: "Mainland",
  UNDECIDED: "Not decided",
};

export const kindLabels: Record<string, string> = {
  MAIN: "Main activity",
  LIGHT: "Light activity",
  FULL_DAY: "Full day",
};

export const categoryShortLabels: Record<string, string> = {
  nature: "Nature",
  waterfront: "Waterfront",
  "local-life": "Lagos Life",
  food: "Food & drink",
  culture: "Arts & culture",
  nightlife: "Nightlife",
  recreation: "Recreation",
  shopping: "Shopping & style",
};

export function displayName(name: string) {
  return name.replace(/\s*[—-]\s*DEMO$/, "");
}

export function zoneLabel(zone: string) {
  return zoneLabels[zone] ?? zone;
}

function hours(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const value = minutes / 60;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} hr${value === 1 ? "" : "s"}`;
}

export function formatDuration(min: number, max = min) {
  if (min === max) return hours(min);
  if (min < 60 && max <= 60) return `${min}–${max} min`;
  if (min < 60) return `${min} min–${hours(max)}`;
  return `${hours(min).replace(/ hrs?$/, "")}–${hours(max)}`;
}

export function formatMoney(minor: number, fractionDigits = 0) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(minor / 100);
}

export function priceBasisLabel(basis: string) {
  return basis === "PER_ADULT" ? "per adult" : "per group";
}

type Story = { teaser: string; summary: string; why: string };

// Sample copy for the fictional demo offers, keyed by catalogue seed key.
const stories: Record<string, Story> = {
  "nature-walk": {
    teaser: "Boardwalks, birdsong and green shade before the city wakes.",
    summary:
      "An unhurried morning walk through protected greenery, with time to stop, look and listen.",
    why: "A calm, restorative start that balances busier city days.",
  },
  gallery: {
    teaser: "Contemporary Nigerian art, at your own pace.",
    summary:
      "A self-paced visit to a contemporary art space showing painting, textile and sculpture.",
    why: "See how Lagos artists are shaping the conversation today.",
  },
  "local-market": {
    teaser: "Navigate a busy market with a host who knows it well.",
    summary:
      "A hosted walk through a working market: fabrics, spices, produce and the people behind the stalls.",
    why: "The everyday energy of Lagos, with someone to translate, guide and explain.",
  },
  suya: {
    teaser: "Smoky, spiced suya and the evening street-food ritual.",
    summary:
      "A hosted evening tasting suya and other favourites from trusted local grills.",
    why: "Lagos after dark tastes like this. Your host handles the ordering.",
  },
  beach: {
    teaser: "An afternoon of sea air, sand and open horizon.",
    summary:
      "A relaxed afternoon by the water with time to swim, sit back and watch the waves.",
    why: "The easiest way to slow down between city days.",
  },
  cooking: {
    teaser: "Cook jollof, plantain and stew with a home cook.",
    summary:
      "A hands-on session in a home-style kitchen: prepare classic dishes, then sit down to eat them.",
    why: "Take home recipes, not just photos.",
  },
  music: {
    teaser: "Live bands and a host to show you the scene.",
    summary:
      "A hosted evening of live music, from highlife to Afrobeats, with a table for your group.",
    why: "Music is how Lagos celebrates. Hear it where it lives.",
  },
  makers: {
    teaser: "Meet designers and makers shaping Lagos style.",
    summary:
      "A hosted visit to studios and boutiques working with adire, aso-oke and contemporary fashion.",
    why: "Discover the craft behind the clothes, and shop with context.",
  },
  gardens: {
    teaser: "A short, quiet pause among trees and lawns.",
    summary: "A light visit to a garden setting for a breather between plans.",
    why: "Fits neatly into a gap in your day.",
  },
  games: {
    teaser: "Friendly games and a relaxed social hour.",
    summary:
      "A light, social session of games, suited to groups and mixed ages of adults.",
    why: "A playful break that doesn’t need much planning.",
  },
  history: {
    teaser: "A full day through the stories, art and landmarks of Lagos.",
    summary:
      "A hosted day linking galleries, monuments and historic quarters into one story of the city.",
    why: "The deepest single-day introduction to Lagos history and culture.",
  },
  neighbourhood: {
    teaser: "Old streets, new stories, with a neighbourhood host.",
    summary:
      "A hosted walk through a characterful neighbourhood, its architecture and everyday rhythms.",
    why: "See the Lagos most visitors drive past.",
  },
};

export function storyFor(
  seedKey: string | undefined,
  categoryId: string,
): Story {
  return (
    (seedKey ? stories[seedKey] : undefined) ?? {
      teaser: `A ${categoryShortLabels[categoryId]?.toLowerCase() ?? "local"} experience in Lagos.`,
      summary: "Details for this experience are being prepared.",
      why: "",
    }
  );
}
