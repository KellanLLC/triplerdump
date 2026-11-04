// Google reviews on the homepage: star rating, review count and the review cards.
//
// The numbers live in D1 settings key `google_reviews` and are written into the
// homepage by marketing.js on every request (data-trd-num markers + the JSON block
// the carousel reads), so a new review shows up without a rebuild.
//
// Where the numbers come from:
// - With a GOOGLE_PLACES_API_KEY worker secret: the hourly cron asks the Places API
//   (New) for rating, userRatingCount and its (max 5) reviews once a day, and merges
//   new reviews in front of the ones already shown.
// - Without the key: DEFAULT_GOOGLE_REVIEWS below (checked on Google Maps by hand,
//   2026-10-07). Nothing breaks; the numbers just don't move on their own.
// Only reviews Google returns are shown, newest first, no filtering by stars.

// Joseph's profile (CID 8339345795908710583). See CLAUDE.md "GOOGLE BUSINESS PROFILE".
export const PLACE_ID = "ChIJ31PA2IU4wmIRtzBJUNFOu3M";
export const MAPS_URL = "https://www.google.com/maps?cid=8339345795908710583";
const MAX_REVIEWS = 12;
const REFRESH_HOURS = 20; // hourly cron, so this lands roughly once a day

// Seed list = the cards the homepage has always shown (owner-approved excerpts),
// plus Connie Collard. `date` and `photo` (the reviewer's Google profile photo)
// only where verified on Google Maps 2026-10-08; cards without them show no
// date line and a coloured initial, as Google does. Verified ones go first.
// 2026-10-09: count 18 -> 20 and five newer 5-star reviews added in front,
// text verbatim from Google. Their dates are worked back from Google's relative
// times ("a day ago", "a week ago", "2 weeks ago", "3 weeks ago") as of
// 2026-10-09, so the last three are accurate to about a week. No photos.
export const DEFAULT_GOOGLE_REVIEWS = {
  rating: 5.0,
  count: 20,
  updatedAt: null,
  source: "manual",
  reviews: [
    { name: "javen garcia", rating: 5, date: "2026-10-08", text: "Highly recommended 👍🏽" },
    { name: "David Hickson", rating: 5, date: "2026-10-02", text: "Had an amazing experience. So useful and courteous. Very punctual and a pleasure to work with. I would definitely use this service again!!" },
    { name: "Chandler Drachman", rating: 5, date: "2026-10-02", text: "Joseph with Triple R runs an Amazing company he has came through and helped me out with a bunch of projects where I needed a dumpster last second." },
    { name: "Travis Rodeback", rating: 5, date: "2026-09-25", text: "Best price ,awesome service!" },
    { name: "Lee Hennerichs", rating: 5, date: "2026-09-18", text: "They were so helpful on our house flip project. They came out everyday through the junk removal and trashout process and had a new dumpster dropped off each time on time. I would strongly recommend this company to anyone who is needing a dumpster and stright forward communication." },
    { name: "Connie Collard", rating: 5, date: "2026-07", photo: "https://lh3.googleusercontent.com/a/ACg8ocJie9oenj4e12rCCBpbKGN1dtYf5E-ZrjwKTPn_yOqMwYzPlQ=w72-h72-p-rp-mo-br100", text: "Triple R Dump is amazing! We've used them a couple of times and they are great! Very accommodating and nice to work with! Highly recommend!" },
    { name: "Scott", rating: 5, date: "2026-05", photo: "https://lh3.googleusercontent.com/a/ACg8ocJ0nzisT5pWRpAgWYCNd-r9-kpYlNx-eNIQqXUnaRhbTn3w-g=w72-h72-p-rp-mo-br100", text: "Easy booking and they delivered right on time. The driver was professional and careful not to damage the driveway. Smooth pickup, no hidden fees or surprises." },
    { name: "Jorge Martinez", rating: 5, date: "2026-05", photo: "https://lh3.googleusercontent.com/a/ACg8ocLZdnkd70XSTzpmQsKTZxNKiivfqcX_xHQvLlrOnikcWuobDg=w72-h72-p-rp-mo-ba12-br100", text: "Couldn't be happier, everything went smoothly start to finish. Joseph communicated clearly, answered all my questions, and made the whole process incredibly easy." },
    { name: "Nadine Rendon", rating: 5, text: "Dropped off the dumpster exactly when they said, and set it on wooden beams so it wouldn't damage my driveway. Would recommend them to anyone. Great business!!" },
    { name: "Greg", rating: 5, text: "Excellent experience! Joe got us set up fast with the perfect dumpster, and delivery, pickup, and hauling were all on time. Great service, highly recommend!" },
    { name: "Clayton Coombs", rating: 5, text: "Made the whole process easy. Midway through I needed a bigger bin and Joseph switched me from a 15 to a 20 yd, no headache. That kind of service is hard to find." },
    { name: "Jordyn Hill", rating: 5, text: "Such a great experience! Scheduling was a breeze and he delivered right on time. I even asked for same-day pickup on a Saturday and he made it happen!" },
  ],
};

export function mergeGoogleReviews(saved) {
  const d = DEFAULT_GOOGLE_REVIEWS;
  if (!saved || typeof saved !== "object") return { ...d, reviews: [...d.reviews] };
  return {
    rating: Number.isFinite(saved.rating) ? saved.rating : d.rating,
    count: Number.isFinite(saved.count) ? saved.count : d.count,
    updatedAt: saved.updatedAt || null,
    source: saved.source || d.source,
    reviews: Array.isArray(saved.reviews) && saved.reviews.length ? saved.reviews : [...d.reviews],
  };
}

const sameReview = (a, b) =>
  String(a.name || "").trim().toLowerCase() === String(b.name || "").trim().toLowerCase();

// Places API (New) review -> our card shape. Text is Google's original, trimmed for
// the card; the full review is one tap away on Google.
function fromPlaces(r) {
  const text = String((r.originalText && r.originalText.text) || (r.text && r.text.text) || "").replace(/\s+/g, " ").trim();
  return {
    name: String((r.authorAttribution && r.authorAttribution.displayName) || "Google user").trim(),
    rating: Number(r.rating) || 5,
    date: r.publishTime ? String(r.publishTime).slice(0, 10) : undefined,
    text: text.length > 260 ? text.slice(0, 257).replace(/\s+\S*$/, "") + "…" : text,
    url: (r.authorAttribution && r.authorAttribution.uri) || undefined,
    photo: (r.authorAttribution && r.authorAttribution.photoUri) || undefined,
  };
}

// Pure: new Places data folded over what is stored. Newest Google reviews first;
// a reviewer already shown is replaced by Google's version (fresh date/text).
export function applyPlacesResponse(current, data, nowIso) {
  const cur = mergeGoogleReviews(current);
  const fresh = (Array.isArray(data && data.reviews) ? data.reviews : []).map(fromPlaces).filter((r) => r.text);
  fresh.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const kept = cur.reviews.filter((old) => !fresh.some((n) => sameReview(n, old)));
  return {
    rating: Number.isFinite(data && data.rating) ? Math.round(data.rating * 10) / 10 : cur.rating,
    count: Number.isFinite(data && data.userRatingCount) ? data.userRatingCount : cur.count,
    updatedAt: nowIso,
    source: "places",
    reviews: [...fresh, ...kept].slice(0, MAX_REVIEWS),
  };
}

// Cron job. No key -> no-op. Network/API errors leave the stored numbers alone.
export async function refreshGoogleReviews(env, S, now = new Date()) {
  if (!env.GOOGLE_PLACES_API_KEY) return { skipped: "no key" };
  const cur = S.googleReviews || mergeGoogleReviews(null);
  if (cur.updatedAt && now - new Date(cur.updatedAt) < REFRESH_HOURS * 3600 * 1000) return { skipped: "fresh" };
  const res = await fetch("https://places.googleapis.com/v1/places/" + PLACE_ID, {
    headers: {
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "rating,userRatingCount,reviews",
    },
  });
  if (!res.ok) throw new Error("places " + res.status + " " + (await res.text()).slice(0, 200));
  const next = applyPlacesResponse(cur, await res.json(), now.toISOString());
  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES ('google_reviews', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2"
  ).bind(JSON.stringify(next), now.toISOString()).run();
  return { updated: true, rating: next.rating, count: next.count };
}

// ---- rendering into the homepage -------------------------------------------------
export const ratingText = (g) => g.rating.toFixed(1);

// Values for <... data-trd-num="key">old</...> markers.
export function reviewNumbers(g) {
  return { g_rating: ratingText(g), g_count: String(g.count) };
}

// JSON for <script type="application/json" id="trd-reviews">. "<" escaped so a
// review containing "</script>" can't break out of the block.
export function reviewsJson(g) {
  const cards = g.reviews.map((r) => ({
    name: r.name, rating: r.rating, date: r.date || null, text: r.text,
    // only Google-hosted profile photos; anything else falls back to an initial
    photo: /^https:\/\/[a-z0-9.-]*googleusercontent\.com\//i.test(String(r.photo || "")) ? r.photo : null,
  }));
  return JSON.stringify({ rating: g.rating, count: g.count, url: MAPS_URL, reviews: cards }).replace(/</g, "\\u003c");
}
