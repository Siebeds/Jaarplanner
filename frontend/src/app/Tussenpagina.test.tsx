import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tussenpagina } from "./Tussenpagina";

/**
 * The tussenpagina is drawn twice (TB-026): statically in `index.html`, for the moment before the script
 * has loaded, and by `Tussenpagina` once it has. React replaces the one with the other, so they have to be
 * the same markup, or the page visibly changes at the handover. Nothing but this test keeps them in step.
 */
const zonderWitruimte = (html: string) => html.replace(/>\s+</g, "><").trim();

describe("Tussenpagina", () => {
  it("is dezelfde tekening als de statische kopie in index.html", () => {
    // Resolved from the run root, as in catalogus.test.ts: Vitest hands modules a non-file URL.
    const bron = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const statisch = new DOMParser().parseFromString(bron, "text/html").querySelector("#root > main");

    const { container } = render(
      <Tussenpagina>
        <p className="tussenpagina-status" />
      </Tussenpagina>,
    );

    expect(statisch).not.toBeNull();
    expect(zonderWitruimte(container.innerHTML)).toBe(zonderWitruimte(statisch!.outerHTML));
  });
});
