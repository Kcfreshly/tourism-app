import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
async function page(path) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  return response.text();
}
const agent = await page("/plan/new?mode=chat");
assert(agent.includes("Tell Kemi about your trip."));
assert(
  !agent.includes("Arrival date"),
  "The agent stage must not display the manual form.",
);
const manual = await page("/plan/new?mode=form");
assert(manual.includes("Arrival date"));
assert(manual.includes("Review trip summary"));
const home = await page("/");
assert(home.includes("/assets/photos/lekki-canopy.webp"));
const explore = await page("/explore");
assert(explore.includes("Find experiences worth making time for."));
assert(explore.includes("/assets/photos/"));
const credits = JSON.parse(
  await readFile(
    new URL("../public/assets/photos/credits.json", import.meta.url),
    "utf8",
  ),
);
const creditPage = await page("/photo-credits");
for (const photo of credits) {
  assert(creditPage.includes(photo.author));
  const response = await fetch(base + photo.src);
  assert.equal(response.status, 200, photo.src);
  assert(response.headers.get("content-type").includes("image/webp"));
  const data = Buffer.from(await response.arrayBuffer());
  assert.equal(data.toString("ascii", 0, 4), "RIFF");
  assert.equal(data.toString("ascii", 8, 12), "WEBP");
}
console.log(
  "PASS: agent/manual entry stages, explore guidance, photo credits and all four locally served photo assets. Visual layout and microphone behaviour require a browser.",
);
