import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The browser set (FB-085): tab icon and title, the home-screen icon through the web app manifest, and
 * the theme-color. None of it renders in jsdom, so these read the files the browser reads and check
 * that what they point at exists and matches, which is what breaks silently when a file is renamed or
 * a colour token moves.
 */

const wortel = process.cwd();
const html = readFileSync(join(wortel, "index.html"), "utf8");
const publiek = (pad: string) => join(wortel, "public", ...pad.replace(/^\//, "").split("/"));

function attribuut(tag: string, naam: string) {
  return new RegExp(`${naam}="([^"]*)"`).exec(tag)?.[1];
}

const links = [...html.matchAll(/<link [^>]*>/g)].map(([tag]) => ({
  rel: attribuut(tag, "rel"),
  href: attribuut(tag, "href"),
}));

/** `hsl(h s% l%)` as the browser rounds it to #rrggbb. */
function hslNaarHex(hsl: string) {
  const [h, s, l] = hsl.match(/[\d.]+/g)!.map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const kanaal = (n: number) => {
    const k = (n + h / 30) % 12;
    const waarde = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * waarde)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${kanaal(0)}${kanaal(8)}${kanaal(4)}`;
}

const css = readFileSync(join(wortel, "src", "index.css"), "utf8");
const vlakWaarden = [...css.matchAll(/--color-vlak:\s*(hsl\([^)]*\))/g)].map(([, hsl]) => hslNaarHex(hsl));

describe("de browserset", () => {
  it("noemt het tabblad Vizier", () => {
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe("Vizier");
  });

  it("wijst elk icoon en het manifest aan met een bestand dat bestaat", () => {
    const rels = links.map((link) => link.rel);
    expect(rels).toEqual(expect.arrayContaining(["icon", "apple-touch-icon", "manifest"]));
    for (const { href } of links) expect(existsSync(publiek(href!)), href).toBe(true);
  });

  it("haalt de iconen uit public/merk, zodat een nieuw icoon geen codewijziging vraagt", () => {
    const iconen = links.filter((link) => link.rel !== "manifest").map((link) => link.href);
    expect(iconen.length).toBeGreaterThan(0);
    for (const href of iconen) expect(href).toMatch(/^\/merk\//);
  });

  it("vraagt het oude merk.svg nergens meer op", () => {
    expect(existsSync(publiek("/merk.svg"))).toBe(false);
    expect(html).not.toContain("/merk.svg");
  });

  it("geeft de browserrand het papier in licht en de donkere grond in donker", () => {
    // Guards the parse itself: the light value from @theme and the dark one from the dark block.
    expect(vlakWaarden).toHaveLength(2);
    const metas = [...html.matchAll(/<meta name="theme-color"[^>]*>/g)].map(([tag]) => ({
      media: attribuut(tag, "media"),
      kleur: attribuut(tag, "content"),
    }));
    expect(metas).toEqual([
      { media: "(prefers-color-scheme: light)", kleur: vlakWaarden[0] },
      { media: "(prefers-color-scheme: dark)", kleur: vlakWaarden[1] },
    ]);
  });
});

describe("het web-app-manifest", () => {
  const href = links.find((link) => link.rel === "manifest")!.href!;
  const manifest = JSON.parse(readFileSync(publiek(href), "utf8"));

  it("zet de app als Vizier in een eigen venster op het startscherm", () => {
    expect(manifest).toMatchObject({ name: "Vizier", short_name: "Vizier", start_url: "/", display: "standalone" });
    expect(manifest.background_color).toBe(vlakWaarden[0]);
    expect(manifest.theme_color).toBe(vlakWaarden[0]);
  });

  it("wijst iconen van 192 en 512 pixels aan die bestaan en zo groot zijn", () => {
    const maten = manifest.icons.map((icoon: { sizes: string }) => icoon.sizes);
    expect(maten).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icoon of manifest.icons as { src: string; sizes: string }[]) {
      expect(icoon.src).toMatch(/^\/merk\//);
      const png = readFileSync(publiek(icoon.src));
      // A PNG's IHDR holds width and height as big-endian integers at bytes 16 and 20.
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icoon.src).toBe(icoon.sizes);
    }
  });
});
