import { profileSchema, type Profile, categoryIds } from "./profile";
const names: Record<string, string[]> = {
  nature: ["nature", "garden", "outdoors"],
  waterfront: ["beach", "waterfront"],
  "local-life": ["lagos life", "local life", "market", "neighbourhood"],
  food: ["food", "cooking", "suya"],
  culture: ["art", "culture", "history", "gallery"],
  nightlife: ["nightlife", "music"],
  recreation: ["games", "recreation"],
  shopping: ["shopping", "fashion"],
};
export function extractProfile(profile: Profile, message: string) {
  const text = message.toLowerCase();
  const next = structuredClone(profile);
  const questions: string[] = [];
  const dates = message.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (dates?.length === 2) {
    next.startDate = dates[0];
    next.endDate = dates[1];
  } else if (!profile.startDate || !profile.endDate)
    questions.push(
      "What are your arrival and departure dates? Use YYYY-MM-DD for each.",
    );
  const adults = text.match(
    /\b([1-8])\s*(?:adults?|travellers?|travelers?|people)\b/,
  );
  if (adults) next.adults = Number(adults[1]);
  else if (/\b(?:with my partner|couple|two adults)\b/.test(text))
    next.adults = 2;
  else if (!profile.adults)
    questions.push("How many adults are travelling (1–8)?");
  const interests = categoryIds.filter((id) =>
    names[id].some((name) => new RegExp(`\\b${name}\\b`, "i").test(text)),
  );
  if (interests.length) next.interests = interests;
  if (/\banniversary\b/.test(text)) next.occasion = "Anniversary";
  else if (/\bbirthday\b/.test(text)) next.occasion = "Birthday";
  if (/\brelaxed\b/.test(text)) next.pace = "RELAXED";
  else if (/\bbalanced\b/.test(text)) next.pace = "BALANCED";
  if (/\bno alcohol\b/.test(text)) next.alcohol = "NO_ALCOHOL";
  const accommodation = message.match(
    /(?:accommodation|hotel|starting area|base)\s*:\s*([^;\n.]+)/i,
  );
  if (accommodation) next.accommodation = accommodation[1].trim().slice(0, 300);
  const budget = text.match(/budget\s*(?::|is)?\s*(?:ngn|naira)?\s*([\d,]+)/);
  if (budget) next.budgetMinor = Number(budget[1].replaceAll(",", "")) * 100;
  for (const zone of ["LEKKI", "VI", "MAINLAND"] as const)
    if (new RegExp(`\\b${zone}\\b`, "i").test(message)) next.zoneId = zone;
  const dietary = message.match(/dietary(?: requirements)?\s*:\s*([^;\n.]+)/i);
  if (dietary) next.dietary = dietary[1].trim().slice(0, 300);
  const accessibility = message.match(
    /accessibility(?: requirements)?\s*:\s*([^;\n.]+)/i,
  );
  if (accessibility) next.accessibility = accessibility[1].trim().slice(0, 300);
  if (/full[ -]day guide/.test(text)) next.assistance = "FULL_DAY_GUIDE";
  else if (/activity guide/.test(text)) next.assistance = "ACTIVITY_GUIDE";
  else if (/driver only/.test(text)) next.assistance = "DRIVER_ONLY";
  if (/own transport/.test(text)) next.transport = "OWN";
  if (/full pace/.test(text)) next.pace = "FULL";
  const parsed = profileSchema.safeParse(next);
  if (!parsed.success)
    return {
      profile,
      changes: [],
      questions: [
        "Please confirm valid dates (1–30 days) and a party of 1–8 adults.",
      ],
      adapter: "deterministic" as const,
    };
  const changes = (Object.keys(next) as (keyof Profile)[])
    .filter((key) => JSON.stringify(profile[key]) !== JSON.stringify(next[key]))
    .map((key) => ({ field: key, before: profile[key], after: next[key] }));
  return {
    profile: parsed.data,
    changes,
    questions: questions.slice(0, 2),
    adapter: "deterministic" as const,
  };
}
