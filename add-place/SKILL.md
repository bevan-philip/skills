---
name: add-place
description: Add a new place note to this vault's London Places collection (London Places/Places/*.md), matching the existing frontmatter schema and file layout, and using a real web geocoding lookup — never a guessed or estimated coordinate — to get accurate lat/lng, area and borough. Use this whenever the user asks to add a restaurant, cafe, bakery, bar, pub, museum, park, shop, market, or any other place to their Places list, mentions "London Places", "Places.base", or wants a new place logged for London, even if they don't spell out the exact frontmatter fields themselves.
---

# Add a place to London Places

Creates one new markdown note in `London Places/Places/` for a real-world London place, in the same shape the sibling notes already use, so it shows up correctly in `London Places/Places.base` (the Map, All places, Food, and Still to visit views all key off these frontmatter fields).

## Why the web lookup step matters

A coordinate that's "close enough" from memory is not good enough — a memory-based guess for a real flagship store once landed six minutes' walk from the actual building. The Map view plots `note.location` directly, so a wrong pin defeats the point of the note. Always verify location through a real geocoding lookup before writing the file; never estimate from general knowledge of the area.

## Steps

1. **Read the schema fresh, don't assume it's fixed.** Read `London Places/Places.base` for the current property list and filters, and read 2-3 sibling notes in `London Places/Places/` in the same category as the new place (e.g. another `Food` note) to confirm the current frontmatter shape, quoting style, and field order. The vault owner edits notes by hand after they're created, so sibling files are the source of truth — not this skill's memory of them.

2. **Nail down what the place actually is.** If the user's phrasing is ambiguous or shorthand (e.g. names a landmark plus a feature, like "the John Lewis Oxford Street platter thing"), use WebSearch to confirm what it actually is — a shop-in-shop, a cafe, a specific menu item, a pop-up — and to get the venue's real name as it would appear on a sign or listing. Use that real name for the note's title and filename rather than repeating the user's shorthand verbatim, unless they've given you an explicit title.

3. **Geocode with Nominatim — don't estimate.** Use WebFetch against OpenStreetMap's free Nominatim search API:

   `https://nominatim.openstreetmap.org/search?q=<url-encoded query>&format=json&limit=1&addressdetails=1`

   Ask WebFetch's prompt to report back the `lat`, `lon`, and the `address` breakdown (road, suburb/neighbourhood, city_district/borough, postcode) as plain values.

   - Build `<query>` from the most specific real-world description you have (e.g. `"John Lewis, 300 Oxford Street, London"`, not the user's shorthand name) — Nominatim matches addresses and named venues, not vague descriptions of what's sold there.
   - Sanity-check the result against what you already know from step 2: does the returned road/postcode/district line up? If Nominatim returns the wrong city/country, or a low-confidence generic postcode centroid, refine the query (fuller street address, or the parent building's name) and re-fetch rather than accepting it.
   - If the new place lives inside or right next to a venue that's plausibly its own address, prefer geocoding that address directly rather than inventing a more precise point yourself.

4. **Pick `category` and `kind` from what's already in use.** See `references/taxonomy.md` for the current list pulled from the vault. `category` is always one of `Food`, `Fun`, `Culture`. `kind` should match an existing value used for a similar place — check a sibling note if unsure (e.g. pubs are usually filed under `Culture`, not `Food`) — and only introduce a new `kind` when nothing already there fits.

5. **Set `area` and `borough` from the geocode result**, phrased to match how nearby sibling notes name them (see the area/borough list in `references/taxonomy.md`, or grep sibling files for the same postcode district) rather than using Nominatim's raw suburb string verbatim.

6. **Write the note** at `London Places/Places/<Name>.md`, mirroring a sibling file's exact structure:

   ```
   ---
   type: place
   category: "<Food|Fun|Culture>"
   kind: "<kind>"
   area: "<area>"
   borough: "<borough>"
   location: [<lat>, <lng>]
   lat: <lat>
   lng: <lng>
   status: to-visit
   geocoded: true
   visited:
   rating:
   tags:
     - place
     - <category lowercase>
     - <kind lowercase>
   ---

   # <Name>

   <one or two sentence description, matching the terse, personal tone of sibling notes — cite a source URL if the description comes from one>

   ## Notes

   ```

7. **Tell the user what you looked up**, briefly: the coordinates found and where they came from (e.g. "geocoded via Nominatim to 300 Oxford Street"), so they can spot-check it — you can't visually confirm a map pin yourself.

## Common mistakes to avoid

- Don't invent or round-to-a-nearby-landmark coordinates from memory — always run the Nominatim lookup in step 3, even for places you're confident you already know the location of.
- Don't use `category` or `kind` values outside the vault's existing taxonomy without checking `references/taxonomy.md` and a sibling note first.
- Don't skip reading a sibling note before writing — field order and formatting (e.g. `location:` as a YAML list, unquoted numeric `lat`/`lng`, quoted string fields) matter for `Places.base`'s table/map views to render correctly.
