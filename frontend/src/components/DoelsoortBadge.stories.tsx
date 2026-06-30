import type { Meta, StoryObj } from "@storybook/react";

import { DoelsoortBadge, type Doelsoort } from "./DoelsoortBadge";

/**
 * Storybook catalog entry for the sample design-system component (E0-09 acceptance
 * criterion: "it appears in Storybook"). Each story renders the doelsoort badge from
 * the design tokens; the a11y addon (axe) runs automatically on every story.
 */
const meta = {
  title: "Doelen/DoelsoortBadge",
  component: DoelsoortBadge,
  tags: ["autodocs"],
  argTypes: {
    doelsoort: {
      control: "select",
      options: [
        "md",
        "gemeenschappelijk",
        "verdieping",
        "precurriculum",
        "specifiek",
        "anderstalige",
      ] satisfies Doelsoort[],
    },
  },
} satisfies Meta<typeof DoelsoortBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Minimumdoel: Story = {
  args: { doelsoort: "md" },
};

export const Verdieping: Story = {
  args: { doelsoort: "verdieping" },
};

const alleDoelsoorten: Doelsoort[] = [
  "md",
  "gemeenschappelijk",
  "verdieping",
  "precurriculum",
  "specifiek",
  "anderstalige",
];

/** All doelsoort tokens side by side — the full Art. XII colour palette. */
export const AlleDoelsoorten: Story = {
  args: { doelsoort: "md" },
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {alleDoelsoorten.map((soort) => (
        <DoelsoortBadge key={soort} doelsoort={soort} />
      ))}
    </div>
  ),
};
