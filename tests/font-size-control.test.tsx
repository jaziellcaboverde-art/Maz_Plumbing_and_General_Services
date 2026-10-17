import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { FontSizeControl } from "@/components/ui/font-size-control";
import { FONT_SIZE_LABELS, FONT_SIZE_LEVELS } from "@/lib/font-size";

beforeEach(() => {
  document.documentElement.removeAttribute("data-font-size");
});

afterEach(cleanup);

describe("FontSizeControl", () => {
  test("shows 4 options with medium selected by default", () => {
    render(<FontSizeControl />);
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("radio", { name: "Medium" })).toBeChecked();
  });

  test.each(FONT_SIZE_LEVELS)("choosing %s updates the root element", async (level) => {
    const user = userEvent.setup();
    render(<FontSizeControl />);
    
    const radio = screen.getByRole("radio", { name: FONT_SIZE_LABELS[level] });

    // If the target level is 'medium' (the default checked item), 
    // click another option first to clear the default state and trigger a real change event
    if (level === "medium") {
      const smallRadio = screen.getByRole("radio", { name: FONT_SIZE_LABELS["small"] });
      await user.click(smallRadio);
      await waitFor(() => expect(smallRadio).toBeChecked());
    }

    // Now click the target radio button to verify it correctly updates the document attribute
    await user.click(radio);
    await waitFor(() => expect(radio).toBeChecked());
    
    expect(document.documentElement.getAttribute("data-font-size")).toBe(level);
  });

  test("keyboard arrows move the selection", async () => {
    const user = userEvent.setup();
    render(<FontSizeControl />);
    await user.click(screen.getByRole("radio", { name: "Medium" }));
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Large" })).toBeChecked());
  });
});
