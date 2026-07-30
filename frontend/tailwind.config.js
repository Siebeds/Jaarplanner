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

        // chrome — ONE structural hue, so categorical colour stays reserved for the
        // domain (see the palette note in src/index.css).
        paper: {
          DEFAULT: channel("paper"),
          diep: channel("paper-diep"),
        },
        card: channel("card"),
        ink: {
          DEFAULT: channel("ink"),
          zacht: channel("ink-zacht"),
        },
        petrol: {
          DEFAULT: channel("petrol"),
          foreground: channel("petrol-foreground"),
          helder: channel("petrol-helder"),
          wash: channel("petrol-wash"),
        },
        attentie: {
          DEFAULT: channel("attentie"),
          zacht: channel("attentie-zacht"),
          ink: channel("attentie-ink"),
        },

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
      fontFamily: {
        // Self-hosted from npm (see the note in src/main.tsx) — never a font CDN, which would
        // leak every visitor's IP to a third party (Art. VI.2). The system stack stays as the
        // fallback so the app is legible before the webfont paints.
        sans: [
          "IBM Plex Sans Variable",
          "IBM Plex Sans",
          "Segoe UI Variable Text",
          "Segoe UI",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Arial",
          "sans-serif",
        ],
        // Leerplandoel codes ("NAT-K3-01") are identifiers a teacher compares character by
        // character, which is what a mono is for.
        mono: [
          "IBM Plex Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
        xl: "calc(var(--radius) + 4px)",
      },
      boxShadow: {
        // Tinted with the ink hue rather than neutral black: a grey shadow on warm paper
        // reads as dirt, a petrol-tinted one reads as depth.
        card: "0 1px 2px hsl(196 38% 13% / 0.04), 0 2px 6px -1px hsl(196 38% 13% / 0.06)",
        lift: "0 6px 16px -4px hsl(196 38% 13% / 0.12), 0 2px 4px -2px hsl(196 38% 13% / 0.08)",
        balk: "0 1px 0 hsl(40 14% 87% / 1)",
      },
      transitionTimingFunction: {
        uit: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
