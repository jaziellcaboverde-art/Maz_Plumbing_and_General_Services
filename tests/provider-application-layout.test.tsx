import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import ProviderApplicationLayout from "@/app/provider-application/layout";

afterEach(cleanup);

describe("provider application layout", () => {
  test("does not render the public home header or footer", () => {
    render(
      <ProviderApplicationLayout params={Promise.resolve({})}>
        <p>Provider application</p>
      </ProviderApplicationLayout>,
    );

    expect(screen.getByText("Provider application")).toBeInTheDocument();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });
});
