import {
  profileSchema,
  readStayLink,
  type Profile,
  type StayRequest,
  categoryIds,
} from "./profile";
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
  if (
    /\b(book|arrange|sort out|find)\b.{0,20}\b(accommodation|hotel|stay)\b/.test(
      text,
    )
  )
    next.accommodationBy = "FASTLIFE";
  if (/full pace/.test(text)) next.pace = "FULL";
  readArrival(next, message);
  readStay(next, message);
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

// Flying in from abroad, and the airport pickup: "we fly in from London",
// "pick us up at the airport", "flight BA75 landing at 06:10", "3 bags".
function readArrival(next: Profile, message: string) {
  const text = message.toLowerCase();
  if (
    /\b(?:from abroad|outside nigeria|overseas|flying in|fly in|diaspora)\b/.test(
      text,
    )
  )
    next.fromAbroad = true;
  else if (
    /\b(?:we|i) (?:live|are|am) (?:in|from) (?:lagos|nigeria)\b/.test(text)
  )
    next.fromAbroad = false;
  if (
    /\bno airport pick-?up\b|\bdon[’']?t need (?:an? )?(?:airport )?pick-?up\b/.test(
      text,
    )
  ) {
    delete next.airportPickup;
    return;
  }
  if (
    /\bairport (?:pick-?up|transfer)\b|\bpick (?:us|me) up (?:at|from) the airport\b|\bmeet (?:us|me) at the airport\b/.test(
      text,
    )
  ) {
    next.fromAbroad = true;
    next.airportPickup ??= {
      airport: "LOS",
      flight: "",
      landingDate: next.startDate,
      landingTime: "",
      travellers: next.adults,
      bags: next.adults,
    };
  }
  const pickup = next.airportPickup;
  if (!pickup) return;
  const flight =
    /\bflight\s*(?:number|no\.?)?\s*:?\s*([a-z0-9]{2}\s?\d{1,4}[a-z]?)\b/i.exec(
      message,
    );
  if (flight) pickup.flight = flight[1].replace(/\s+/g, "").toUpperCase();
  const lands =
    /\b(?:land(?:s|ing)?|arriv(?:e|es|ing))\s*(?:at|by|around)?\s*([01]?\d|2[0-3]):([0-5]\d)\b/i.exec(
      message,
    );
  if (lands) pickup.landingTime = `${lands[1].padStart(2, "0")}:${lands[2]}`;
  const bags = /\b(\d{1,2})\s*(?:bags|suitcases|cases)\b/i.exec(message);
  if (bags) pickup.bags = Math.min(30, Number(bags[1]));
  pickup.travellers = Math.min(pickup.travellers, next.adults);
}

// When Fastlife books the stay: the type of place, a budget per night, and
// a place in mind ("hotel: Eko Hotel", a pasted link) or "recommend one".
// A named place stays unverified until staff check it.
function readStay(next: Profile, message: string) {
  if (next.accommodationBy !== "FASTLIFE") return;
  const text = message.toLowerCase();
  const stay: StayRequest = next.stay ?? {
    type: "HOTEL",
    choice: { kind: "RECOMMEND" },
  };
  if (/\b(?:serviced apartment|short[- ]?let|airbnb|apartment)\b/.test(text))
    stay.type = "APARTMENT";
  else if (/\bguest ?house\b/.test(text)) stay.type = "GUESTHOUSE";
  else if (/\bresort\b/.test(text)) stay.type = "RESORT";
  else if (/\bhotel\b/.test(text)) stay.type = "HOTEL";
  const perNight =
    /(?:ngn|naira|₦)?\s*([\d,]{4,})\s*(?:naira|ngn)?\s*(?:a|per|\/)\s*night\b/i.exec(
      message,
    );
  if (perNight)
    stay.budgetPerNightMinor = Number(perNight[1].replaceAll(",", "")) * 100;
  const url = /https:\/\/\S+/i.exec(message);
  const link = url && readStayLink(url[0].replace(/[).,;]+$/, ""));
  const named = /(?:hotel|stay at|staying at|place)\s*:\s*([^;\n.]+)/i.exec(
    message,
  );
  if (link) stay.choice = { kind: "LINK", ...link };
  else if (named && named[1].trim().length >= 2) {
    stay.choice = { kind: "NAMED", name: named[1].trim().slice(0, 120) };
    // The name was a preference, not a pickup address.
    next.accommodation = "";
  } else if (/\b(?:recommend|no preference|surprise us)\b/.test(text))
    stay.choice = { kind: "RECOMMEND" };
  next.stay = stay;
}
