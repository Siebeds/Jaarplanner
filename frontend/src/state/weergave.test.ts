import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { useWeergave } from "./weergave";

/**
 * Two things are worth asserting here, and neither is that zustand keeps a value.
 *
 * The first is the contract with `index.html`, whose pre-paint script reads this store's storage
 * without importing it. Nothing else connects the two, so a renamed key would bring back the white
 * flash for every teacher who chose dark, and every other test would stay green.
 *
 * The second is the token file. A colour token without a dark value renders as a light patch on a
 * dark screen, and jsdom cannot see colour, so the only thing that catches it is reading the source.
 */

beforeEach(() => {
  localStorage.clear();
  useWeergave.setState({ keuze: "systeem" });
});

describe("weergave", () => {
  it("volgt standaard het toestel en zet dan niets op de pagina", () => {
    expect(useWeergave.getState().keuze).toBe("systeem");
    expect(document.documentElement.dataset.weergave).toBeUndefined();
  });

  it("zet een expliciete keuze op <html>", () => {
    useWeergave.getState().kies("donker");
    expect(document.documentElement.dataset.weergave).toBe("donker");

    useWeergave.getState().kies("licht");
    expect(document.documentElement.dataset.weergave).toBe("licht");
  });

  it("haalt de keuze weg als de leerkracht terug naar het toestel gaat", () => {
    useWeergave.getState().kies("donker");
    useWeergave.getState().kies("systeem");
    expect(document.documentElement.dataset.weergave).toBeUndefined();
  });

  it("bewaart de keuze onder de sleutel en in de vorm die index.html leest", () => {
    useWeergave.getState().kies("donker");

    const bewaard = JSON.parse(localStorage.getItem("jaarplanner-weergave") ?? "null");
    expect(bewaard?.state?.keuze).toBe("donker");

    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    expect(html).toContain('localStorage.getItem("jaarplanner-weergave")');
    expect(html).toContain("bewaard.state.keuze");
  });
});

describe("de donkere tokens", () => {
  const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");
  const kleuren = (blok: string) => new Set([...blok.matchAll(/--color-([a-z-]+):/g)].map(([, naam]) => naam));

  const thema = css.slice(css.indexOf("@theme {"), css.indexOf("\n}\n", css.indexOf("@theme {")));
  const donkerBegin = css.indexOf("@variant dark {");
  const donker = css.slice(donkerBegin, css.indexOf("\n    }\n", donkerBegin));

  it("vindt beide blokken", () => {
    // Without this, a restructured file makes both sets empty and the two checks below pass on nothing.
    expect(kleuren(thema).size).toBeGreaterThan(20);
    expect(kleuren(donker).size).toBeGreaterThan(20);
  });

  it("geven elke kleur een donkere waarde", () => {
    const zonder = [...kleuren(thema)].filter((naam) => !kleuren(donker).has(naam));
    expect(zonder).toEqual([]);
  });

  it("overschrijven geen kleur die niet bestaat", () => {
    // A typo in the dark block declares a variable nothing reads, and the real token keeps its light value.
    const onbekend = [...kleuren(donker)].filter((naam) => !kleuren(thema).has(naam));
    expect(onbekend).toEqual([]);
  });
});

describe("de kleur van de browserrand", () => {
  it("geeft beide theme-color-metas de kleur die de pagina toont", () => {
    // index.html has one meta per device setting (FB-085). jsdom computes no colour, so the page's
    // background is stubbed; what is under test is that neither meta keeps the other weergave's colour.
    for (const media of ["(prefers-color-scheme: light)", "(prefers-color-scheme: dark)"]) {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.media = media;
      meta.content = "#ffffff";
      document.head.append(meta);
    }
    const echt = window.getComputedStyle;
    window.getComputedStyle = () => ({ backgroundColor: "rgb(21, 24, 30)" }) as CSSStyleDeclaration;
    try {
      useWeergave.getState().kies("donker");
      const kleuren = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content);
      expect(kleuren).toEqual(["rgb(21, 24, 30)", "rgb(21, 24, 30)"]);
    } finally {
      window.getComputedStyle = echt;
      useWeergave.getState().kies("systeem");
      document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    }
  });
});
