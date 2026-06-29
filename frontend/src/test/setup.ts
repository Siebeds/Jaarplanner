// Vitest global setup.
// - jest-dom matchers (toBeInTheDocument, …).
// - jest-axe `toHaveNoViolations` matcher for the a11y smoke checks (E0-09).
import "@testing-library/jest-dom";
import { expect } from "vitest";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);
