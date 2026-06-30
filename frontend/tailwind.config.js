/** @type {import('tailwindcss').Config} */

// `hsl(var(--token) / <alpha-value>)` lets every semantic colour support Tailwind
// opacity modifiers (e.g. `bg-doelsoort-md/10`). The channel values live as CSS
// variables in src/index.css — single source of truth for the design tokens (E0-09).
const channel = (name) => `hsl(var(--${name}) / <alpha-value>)`;
const pair = (name) => ({
  DEFAULT: channel(name),
  foreground: channel(`${name}-foreground`),
});

export default {
  // Storybook stories live alongside components and also reference token classes.
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./.storybook/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // base shadcn UI tokens (used by the copied-in primitives)
        background: channel("background"),
        foreground: channel("foreground"),
        border: channel("border"),
        input: channel("input"),
        ring: channel("ring"),
        primary: pair("primary"),
        secondary: pair("secondary"),
        muted: pair("muted"),
        accent: pair("accent"),

        // doelsoort — Op.stap goal types (Art. XII colour conventions)
        doelsoort: {
          md: pair("doelsoort-md"),
          gemeenschappelijk: pair("doelsoort-gemeenschappelijk"),
          verdieping: pair("doelsoort-verdieping"),
          precurriculum: pair("doelsoort-precurriculum"),
          specifiek: pair("doelsoort-specifiek"),
          anderstalige: pair("doelsoort-anderstalige"),
        },

        // suggestiestatus — DoelKoppeling AI-suggestion lifecycle (Art. IV)
        suggestie: {
          voorgesteld: pair("suggestie-voorgesteld"),
          aanvaard: pair("suggestie-aanvaard"),
          geweigerd: pair("suggestie-geweigerd"),
          manueel: pair("suggestie-manueel"),
        },

        // dekking — coverage state (FR-9), BINARY for the MVP (Art. IX.3).
        // A graded "deels" state is an Art. XIV open decision — not pre-defined.
        dekking: {
          gedekt: pair("dekking-gedekt"),
          "niet-gedekt": pair("dekking-niet-gedekt"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
