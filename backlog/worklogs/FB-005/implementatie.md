# FB-005: implementation

Ticket: `backlog/functionele-backlog/FB-005-leerkracht-voegt-per-evaluatiemoment-een.md` (FR-13.5; R10; Art. VI.7;
ADR-0035 §3.6, D15, D16). Branch `ticket/FB-005-kindtekening`, session `kindtekening`. Moved to `klaar-voor-bouw` on
the owner's go-ahead in this session (`--by eigenaar`), then picked up.

## What was built

**Domain** (`Jaarplanner.Domain/Ontwikkelingsrapport`)
- `Kindtekening`: keyed by its `OntwikkelingsrapportId` (one per report, R10), with `Formaat` (`Beeldformaat` Jpeg/Png),
  `Breedte`, `Hoogte`, `Inhoud` and a `Versie` that is new on every replacement. It holds nothing of the upload but the
  re-encoded pixels: no file name, no date.

**Persistence**: migration `AddKindtekeningen`. `kindtekeningen` is a table of its own in PostgreSQL (D15), `bytea`,
keyed by the report and `Cascade` on it, so it goes with the report, the child (D8) and a wiped schooljaar (D7). No
navigation from `Ontwikkelingsrapport`, so no report read can load an image; the report read projects only
`{versie, breedte, hoogte}`.

**Re-encode** (`SkiaTekeningHerwerker`, behind `ITekeningHerwerker`)
- Library: **SkiaSharp 4.152.0** (MIT, over Skia's BSD licence) plus `SkiaSharp.NativeAssets.Linux.NoDependencies` for
  the linux-x64 self-contained publish and CI (D16). ImageSharp was not an option: its licence is not MIT/Apache/BSD.
- Order per ADR-0035 §3.6: `SKCodec` reads the header; not JPEG/PNG → refused; more than the pixel limit → refused
  before a pixel is decoded. Then decode to sRGB (JPEG at libjpeg's n/8 scale, never below the stored size), scale to
  the longest side, apply the EXIF orientation to the pixels, and encode anew from an untagged pixmap. The output has no
  APP1..APP15/COM segments (JPEG) and only IHDR/sBIT/PLTE/tRNS/IDAT/IEND chunks (PNG), so no EXIF, GPS, XMP, IPTC,
  comment, PNG text, time or colour profile survives.
- At most two decodes at once, app-wide (a PNG at the pixel limit decodes to 160 MB).

**Limits** (`Kindtekeningregels`, "de bouw kiest de grenzen"): **20 MB** per file, **40 million pixels** by the header,
stored at most **2400 px** on the longest side (JPEG quality 85). Refusals in Dutch name the limit:
"Dit bestand is groter dan 20 MB. …", "Deze foto heeft meer dan 40 miljoen pixels. …", "Dit bestand kon niet gelezen
worden als JPEG of PNG. Kies een foto of scan als JPEG- of PNG-bestand." (also for a damaged or truncated file).

**API** (`OntwikkelingsrapportenController`, same rows as the report, on the child's klas):
- `GET …/rapporten/{moment}/tekening`: `OntwikkelingsrapportLezen`; the image with `no-store`, `nosniff`, no
  `Content-Disposition` (no file name exists). 404 "Er is geen tekening bij dit rapport." when there is none.
- `PUT …/tekening` (multipart, field `bestand`) and `DELETE …/tekening`: `RapportInvullen` (the row already named the
  drawing). The form is read inside the action, after the rights check: an `IFormFile` parameter would make routing
  answer a JSON request with 415 before the 403 (caught by `ElkeWijzigendeRouteVraagtEenRechtTests`).
- `[RequestSizeLimit]` at 21 MB; no `RequestFormLimits`, which would cut the form off first as an English 400.
- `RapportWeergave` gained `tekening` (`{versie, breedte, hoogte}` or null).

**Frontend** (`RapportScherm`, `rapporten.ts`)
- A "Tekening" block between the rapportdoelen and the besluit (frontend-design pass within ADR-0024): the drawing
  centred on a mat of `vlak-diep` at its own proportions (width/height attributes, so nothing jumps), then the one line
  asking for a photo of the drawing only, "Tekening toevoegen"/"Tekening vervangen" (a label over a real, focusable
  file input; `accept="image/jpeg,image/png"`, so a phone offers the camera), "Tekening verwijderen" behind a
  `Bevestiging`, and "Tekening openen". No accent and no new hue.
- The browser refuses a typed non-JPEG/PNG or a file over 20 MB before sending. The file goes up under the fixed name
  `tekening`, so the phone's file name never leaves the browser.
- Only `mag.rapportInvullen` gets the controls and the request line; a reader after the schooljaar sees the drawing and
  the link, under the report's existing "Dit schooljaar is voorbij…" sentence.
- The image address carries `?versie=`, so a replaced drawing is fetched anew.

## Antagonist

One audit on the finished branch: **COMPLIANT**, no CRITICAL or MAJOR. Three MINOR findings, all fixed without a new
round (ADR-0037):
- `ReadFormAsync` buffered an upload above 64 KB to a temp file, so the original photo with its GPS position lay on the
  server's disk for the length of the request. The route now sets `[RequestFormLimits(MemoryBufferThreshold = 21 MB)]`
  (only that threshold), so the form stays in memory.
- The 20 MB limit is copied by hand into the frontend. Both sides now name the other as its mirror.
- "Nog geen tekening." asserted a drawing is still to come to a reader who can no longer add one: a reader now sees
  "Geen tekening."; "Nog geen tekening." only who may add one.

Gates after the fixes: `dotnet format --verify-no-changes` exit 0; integration tests for the drawing, the report and
the route rights 22/22; frontend report and i18n tests 62/62; `pnpm lint` exit 0.

**Question for the owner (D16), not blocking:** the NuGet packages are MIT (checked in their nuspecs), but the
`THIRD-PARTY-NOTICES.txt` of `SkiaSharp.NativeAssets.Linux.NoDependencies` 4.152.0 lists parts under other licences:
Skia's old GIF decoder and `mozzconf.h` under an MPL 1.1 / GPL 2.0 / LGPL 2.1 tri-licence (lines 316 and 2712), LGPL
text (from line 1477), and IJG, libpng, zlib and FreeType's FTL. D16 names "MIT, Apache or BSD". Whether it judges the
package's own licence or everything compiled into the native library is the owner's reading. Practical exposure is low:
a GIF is refused before any decoding, and the app is hosted, not distributed.

## Choices the owner may want to revisit

- **The limits**: 20 MB, 40 megapixels, and scaling to 2400 px. A modern phone photo (12 to 50 MP) is accepted up to 40
  MP; a 48 or 50 MP photo is refused with the sentence that asks for a lower resolution.
- **The stored drawing is scaled down to 2400 px**, so "bewaar vanuit de app" returns that size, not the phone's original.
- **Position of the block** under the rapportdoelen rather than at the top of the report.

## Tests

- Unit: `KindtekeningTests` (4), `SkiaTekeningHerwerkerTests` (18): EXIF/GPS/XMP/comment gone from a JPEG, text/EXIF/time
  chunks gone from a PNG, transparency kept, four EXIF orientations upright, scaling, the pixel limit refused on a
  header of a few dozen bytes, PDF/GIF/WebP/empty/garbage/truncated refused. Test images are made up in code
  (`Testbeelden`, linked into the integration project): flat two-colour pictures, an invented camera and street.
- Integration (PostgreSQL): `KindtekeningEndpointsTests` (9): add, replace, one per report, a drawing and a text on one
  new report, every refusal in Dutch with nothing stored, rights (another K3 klas, K2, hoofdleerkracht + themabeheer,
  a user with no right: 403; no session: 401; directie can), after the schooljaar read-only, delete, gone with the
  child. `OntwikkelingsrapportEndpointsTests` updated for the new `tekening` field.
- Frontend: `RapportScherm.test.tsx` +8 (show, upload as FormData named `tekening`, client refusals, the server's own
  sentence, 413 as the size refusal, delete behind confirmation, read-only after the schooljaar, directie).
- Full backend suite: unit 1698 passed, 4 skipped. Integration: all green except
  `RechtenAfdwingingTests.Een_leerkracht_leest_de_klassen_van_haar_jaarfase_ook_van_vorig_jaar_en_geen_andere_Z1_Z6`, an
  order-dependent assertion on two Guids (FB-013's test, not touched here) that passed 3 of 3 when run again alone.
- `dotnet format` clean, `pnpm lint` exit 0, frontend report and i18n tests 62 passed.

## Browser check

Real app (API on Kestrel, Vite) on a throwaway database `jaarplanner_fb005`, dropped afterwards; as directie, with a
made-up K3 klas and the made-up child Fien Proefmans.
- Empty block, then a 1600×1200 JPEG with EXIF (camera, GPS, orientation 6), XMP and a comment: shown upright at
  1200×1600; the served file is `image/jpeg`, `no-store,no-cache`, `nosniff`, no `Content-Disposition`, and contains no
  `Exif`, camera, street, `xmpmeta` or `GPS`, and no APP1 marker. The same address without a session: 401.
- PDF: refused in the browser with "Kies een foto of scan als JPEG- of PNG-bestand."; a 21 MB file: "Dit bestand is
  groter dan 20 MB. …"; 20 MB + 10 bytes sent past the screen: 400 with the same sentence from the server. The drawing
  stayed each time.
- Replaced by a PNG with text chunks: new version, `image/png` 900×1200, no text or time chunk; Rapport 2 has no drawing
  (404).
- 390 px: no horizontal scroll, controls 44 px high and wrapping; the request line and the link measure 6.51:1 on the
  card.
- Delete: the confirmation names what goes; afterwards the block says "Nog geen tekening." and the address answers 404.
- **Not reachable from the screen, noted:** 22 MB sent past the screen's check ends as a network error through the Vite
  proxy (Kestrel closes the connection at its request limit) rather than a readable 413. The screen refuses anything
  over 20 MB before sending, which is under the 21 MB request limit, so a teacher never meets it.
