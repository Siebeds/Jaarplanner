import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";

/**
 * Storybook catalog entry for the copied-in shadcn/ui Button primitive (ADR-0017).
 * Demonstrates the variants/sizes; the a11y addon (axe) runs on every story.
 * Story copy is illustrative (not shipped UI) — exempt from the i18n lint guard.
 */
const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
  args: {
    children: "Opslaan",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = {
  args: { variant: "secondary" },
};

export const Outline: Story = {
  args: { variant: "outline" },
};

export const Ghost: Story = {
  args: { variant: "ghost" },
};
