import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { List } from "@/components/ui/list";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { FONT_SIZE_LEVELS, applyFontSize } from "@/lib/font-size";

afterEach(cleanup);

// jsdom has no layout, so this only proves every component renders at every level.
// The visual check (nothing cropped, nothing overlapping) is done in the browser on /dev/components.
describe("every base component renders at all 4 font size levels", () => {
  test.each(FONT_SIZE_LEVELS)("%s", (level) => {
    applyFontSize(level);
    render(
      <>
        <Button variant="primary">Pay deposit</Button>
        <Input label="Mobile number" />
        <Select label="Service">
          <option>Plumbing</option>
        </Select>
        <Checkbox label="I agree" />
        <RadioGroup legend="Method" name="m" options={[{ value: "a", label: "GCash" }]} value={null} onChange={() => {}} />
        <DataTable caption="Bookings" columns={[{ key: "a", header: "A", render: () => "x" }]} rows={[{ id: "1" }]} getRowKey={(r) => r.id} />
        <List label="Payments" items={[{ id: "1", title: "Deposit" }]} />
        <Stepper steps={[{ id: "a", label: "Service" }]} current={0} label="Progress" />
        <EmptyState title="No bookings yet." />
        <FileUpload label="ID" onSelect={() => {}} />
      </>,
    );
    expect(document.documentElement.getAttribute("data-font-size")).toBe(level);
    expect(screen.getByRole("button", { name: "Pay deposit" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
