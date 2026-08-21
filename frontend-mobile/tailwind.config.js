/** @type {import('tailwindcss').Config} */

// `hsl(var(--token) / <alpha-value>)` so every semantic colour supports Tailwind's opacity
// modifiers. The channel values live in src/index.css.
const c = (name) => `hsl(var(--${name}) / <alpha-value>)`;
const pair = (name) => ({ DEFAULT: c(name), foreground: c(`${name}-foreground`) });

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: c("canvas"),
        surface: {
          DEFAULT: c("surface"),
          verhoogd: c("surface-verhoogd"),
        },
        ink: {
          DEFAULT: c("ink"),
          zacht: c("ink-zacht"),
          zwak: c("ink-zwak"),
        },
        rand: c("rand"),

        // Structural hue for THIS app — deliberately warm terracotta, distinct from the
        // desktop app's petrol, so the two are never mistaken for one product mid-comparison.
        terra: {
          DEFAULT: c("terra"),
          foreground: c("terra-foreground"),
          zacht: c("terra-zacht"),
          diep: c("terra-diep"),
        },

        // doelsoort — same hues as the desktop app (Art. XII): the meaning must travel, even
        // though the chrome around it does not.
        doelsoort: {
          md: pair("doelsoort-md"),
          gemeenschappelijk: pair("doelsoort-gemeenschappelijk"),
          verdieping: pair("doelsoort-verdieping"),
          precurriculum: pair("doelsoort-precurriculum"),
          specifiek: pair("doelsoort-specifiek"),
          anderstalige: pair("doelsoort-anderstalige"),
        },
        suggestie: {
          voorgesteld: pair("suggestie-voorgesteld"),
          aanvaard: pair("suggestie-aanvaard"),
          geweigerd: pair("suggestie-geweigerd"),
          manueel: pair("suggestie-manueel"),
        },
        dekking: {
          gedekt: pair("dekking-gedekt"),
          "niet-gedekt": pair("dekking-niet-gedekt"),
        },
      },
      fontFamily: {
        sans: [
          "Segoe UI Variable Text",
          "Segoe UI",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.375rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        kaart: "0 1px 2px hsl(20 40% 20% / 0.06), 0 4px 14px -4px hsl(20 40% 20% / 0.10)",
        zweven: "0 10px 28px -8px hsl(20 45% 18% / 0.22)",
        navbar: "0 -2px 12px -2px hsl(20 40% 20% / 0.10)",
      },
      spacing: {
        touch: "2.75rem",
      },
    },
  },
  plugins: [],
};
