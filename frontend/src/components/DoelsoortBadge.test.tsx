import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DoelsoortBadge, type Doelsoort } from "./DoelsoortBadge";
import { Button } from "./ui/button";

/**
 * Axe accessibility smoke check (E0-09 acceptance criterion: "passes an axe
 * accessibility smoke check") + design-token rendering check. Runs in `pnpm test`
 * so the E0-08 CI gate exercises it. Asserts the sample design-system components
 * have no axe (WCAG) violations — the automated half of the ADR-0017 a11y bar.
 */
const alleDoelsoorten: Doelsoort[] = [
  "md",
  "gemeenschappelijk",
  "verdieping",
  "precurriculum",
  "specifiek",
  "anderstalige",
];

describe("DoelsoortBadge", () => {
  it("renders the doelsoort abbreviation as visible text (colour is not the sole signal)", () => {
    const { getByText } = render(<DoelsoortBadge doelsoort="md" />);
    expect(getByText("MD")).toBeInTheDocument();
  });

  it("exposes the full Dutch doelsoort label as the accessible name", () => {
    const { getByLabelText } = render(
      <DoelsoortBadge doelsoort="verdieping" />,
    );
    expect(getByLabelText("Verdieping")).toBeInTheDocument();
  });

  it("has no axe violations for every doelsoort variant", async () => {
    const { container } = render(
      <ul>
        {alleDoelsoorten.map((soort) => (
          <li key={soort}>
            <DoelsoortBadge doelsoort={soort} />
          </li>
        ))}
      </ul>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Button (design-system primitive)", () => {
  it("has no axe violations", async () => {
    const { container } = render(<Button>Opslaan</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
