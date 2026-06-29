import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * i18n guard (E0-06, Constitution Art. II.3 / ADR-0005): user-facing copy must come
 * from `nl.json` via the `t()` helper, never be hard-coded in components. We enforce
 * this with the built-in `no-restricted-syntax` rule (no extra dependency) via two
 * AST selectors that target exactly the places real copy lives:
 *
 *   1. `JSXText` with any letter  — text rendered as a JSX child, e.g. `<p>Hallo</p>`.
 *      Whitespace/punctuation-only text (newlines, indentation) is allowed.
 *   2. String literals passed to the user-facing accessibility/text attributes
 *      `aria-label`, `title`, `placeholder`, and `alt` — e.g. `aria-label="Sluiten"`.
 *
 * Deliberately NOT flagged (avoids false positives): `className`, `id`, `key`, `type`,
 * `role`, `htmlFor`, data-/test props, and any string passed to `t(...)`. The rule is a
 * structural heuristic, not a Dutch-language detector: it forces all rendered text and
 * a11y labels through `t()`. Limit: an English literal in those slots is flagged too,
 * which is the intended discipline for a Dutch-only UI; route copy through `t()`.
 */
const noHardcodedJsxText = {
  selector: "JSXText[value=/[A-Za-z]/]",
  message:
    "No hard-coded UI text in JSX. Move user-facing strings to frontend/src/i18n/nl.json and use t('...') (Constitution Art. II.3).",
};

const noHardcodedTextAttribute = {
  selector:
    "JSXAttribute[name.name=/^(aria-label|title|placeholder|alt)$/] > Literal[value=/[A-Za-z]/]",
  message:
    "No hard-coded UI text in a user-facing attribute. Use t('...') from frontend/src/i18n/nl.json (Constitution Art. II.3).",
};

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "no-restricted-syntax": [
        "error",
        noHardcodedJsxText,
        noHardcodedTextAttribute,
      ],
    },
  },
  {
    // Tests assert against rendered copy and reference nl.json values directly;
    // they are not shipped UI, so the JSX-text guard does not apply to them.
    files: ["**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
