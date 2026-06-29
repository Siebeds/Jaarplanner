import type { Preview } from "@storybook/react";

// Import the app's global stylesheet so stories pick up the Tailwind design
// tokens (src/index.css ↔ tailwind.config.js). Without this, token-based
// components would render unstyled in Storybook.
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Run axe on every story; surface violations in the a11y addon panel.
    a11y: {
      test: "error",
    },
  },
};

export default preview;
