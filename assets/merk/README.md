# The Vizier brand kit

The delivered logo package, kept here as the source of truth. Nothing in this folder is served: what the
app actually loads lives in `frontend/public/merk/`, under fixed, meaning-bearing names, so swapping the
logo is a copy and not a code change.

## What is here

| Folder     | What it holds                                                                          |
| ---------- | -------------------------------------------------------------------------------------- |
| `svg/`     | Every variant as vector. The originals; everything else can be re-rendered from these.   |
| `png/`     | The same variants at 1024px, plus the app icon at 512 and 1024.                          |
| `pdf/`     | Vector, for print and for anything a designer opens.                                     |
| `favicon/` | The browser set as delivered: `favicon.ico`, `favicon.svg`, `apple-touch-icon`, 192, 512. |

Four shapes (`beeldmerk` the V alone, `woordmerk` the name alone, `horizontaal`, `gestapeld`) × four
colourways (`kleur` for light grounds, `kleur-op-donker` for dark ones, `wit`, `zwart`).

The 2048px and 4096px rasters that came with the kit are not committed: they are four megabytes that any
of the SVGs reproduces. The untouched original package is the archive.

## The colours are ours

The kit was drawn on this app's palette, so it needs no adaptation:

| Logo      | Hex       | Token in `frontend/src/index.css`         |
| --------- | --------- | ----------------------------------------- |
| `#15181E` | ink       | `--color-inkt`                            |
| `#C6CAD2` | grey wing | the line greys                            |
| `#126C78` | teal dot  | `--color-accent` = `hsl(187 74% 27%)`     |
| `#39B5C6` | teal dot on dark | `--color-accent` dark = `hsl(187 55% 50%)` |
| `#E6E9EF` / `#5C6370` | the wings on dark | the dark palette's line greys |

So a change of accent hue means redrawing the logo too, not just the stylesheet.

## Changing the logo later

Every file the app loads sits in `frontend/public/merk/` and is referenced by that path alone. To put a
different logo in the app, replace these files, keeping the names:

| File in `frontend/public/merk/` | Where it shows            | From this kit                            |
| ------------------------------- | ------------------------- | ---------------------------------------- |
| `merk-horizontaal.svg`          | sidebar (wide), sign-in screens, tussenpagina, light | `svg/vizier-horizontaal-kleur.svg` |
| `merk-horizontaal-donker.svg`   | the same, dark            | `svg/vizier-horizontaal-kleur-op-donker.svg` |
| `merk-beeldmerk.svg`            | the 56px collapsed rail, light | `svg/vizier-beeldmerk-kleur.svg`    |
| `merk-beeldmerk-donker.svg`     | the same, dark            | `svg/vizier-beeldmerk-kleur-op-donker.svg` |
| `favicon.svg`, `favicon.ico`    | the browser tab           | `favicon/`                                |
| `apple-touch-icon.png`          | an iPad home screen       | `favicon/`                                |
| `icon-192.png`, `icon-512.png`  | the web app manifest      | `favicon/`                                |

Two things do not travel with the files, and are the whole of the code change a rebrand still needs: the
product name in `frontend/src/i18n/nl.json` (`app.naam`, and the sentences under `aanmelding` that name
the product), and `<title>` plus the static tussenpagina copy in `frontend/index.html`.

A logo with different proportions may need its box adjusted in `frontend/src/app/Merk.tsx`; a logo in
other colours needs its hues checked against Art. XII before it goes in, since the palette has no room
left for a sixth family.
