import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook config (E0-09, ADR-0017 §3). React + Vite builder, reusing the app's
 * Vite/Tailwind pipeline so stories render with the real design tokens. The a11y
 * addon runs axe in the Storybook UI (the interactive half of the ADR-0017 a11y
 * bar; the automated half is the jest-axe smoke test in `pnpm test`).
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // No anonymous telemetry — keep the build offline/quiet (privacy hygiene).
  core: {
    disableTelemetry: true,
  },
};

export default config;
