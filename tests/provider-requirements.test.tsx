import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ProviderRequirements } from "@/components/provider/provider-requirements";
import {
  OPTIONAL_PROVIDER_DOCUMENTS,
  REQUIRED_PROVIDER_DOCUMENTS,
} from "@/lib/provider/requirements";

const root = process.cwd();

describe("provider hiring requirements are part of the apply flow", () => {
  test("the requirements box lists every required and optional document", () => {
    render(<ProviderRequirements />);
    const box = screen.getByRole("region", {
      name: "Provider hiring requirements",
    });
    for (const item of [
      ...REQUIRED_PROVIDER_DOCUMENTS,
      ...OPTIONAL_PROVIDER_DOCUMENTS,
    ]) {
      expect(within(box).getByText(item)).toBeInTheDocument();
    }
    expect(
      within(box).getByText(/must upload every required document/i),
    ).toBeInTheDocument();
  });

  test("NBI clearance, ID, selfie and proof of address are all required", () => {
    const joined = REQUIRED_PROVIDER_DOCUMENTS.join(" ").toLowerCase();
    for (const word of [
      "government id",
      "selfie",
      "nbi clearance",
      "proof of address",
      "two references",
    ])
      expect(joined).toContain(word);
  });

  test("the apply page and the application form both show the requirements", () => {
    const applyFlow = readFileSync(
      join(root, "src/app/(public)/apply/provider/apply-flow.tsx"),
      "utf8",
    );
    const form = readFileSync(
      join(
        root,
        "src/app/provider-application/submit/provider-application-form.tsx",
      ),
      "utf8",
    );
    expect(applyFlow).toContain("<ProviderRequirements");
    expect(form).toContain("<ProviderRequirements />");
  });

  test("the API refuses an application that is missing a required document", () => {
    const route = readFileSync(
      join(root, "src/lib/provider/submit-application.ts"),
      "utf8",
    );
    for (const message of [
      "Upload both a government ID and a selfie",
      "Upload your NBI clearance",
      "Upload a barangay clearance or proof of address",
    ]) {
      expect(route).toContain(message);
    }
  });
});
