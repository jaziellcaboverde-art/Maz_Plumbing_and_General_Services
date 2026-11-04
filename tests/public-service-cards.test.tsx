import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ServiceGrid } from "@/components/public/service-grid";
import { ServiceShowcase } from "@/components/services/service-showcase";

describe("public service cards", () => {
  test("keeps quotation-only prices and the portfolio label out of cards", () => {
    render(
      <ServiceGrid
        services={[
          {
            category: "Plumbing",
            name: "Leak repair",
            description: "Repair a leak.",
            startingPricePhp: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /Leak repair/ })).toBeInTheDocument();
    expect(screen.queryByText("Price on quotation")).not.toBeInTheDocument();
    expect(
      screen.queryByText("View portfolio & customer reviews"),
    ).not.toBeInTheDocument();
  });

  test("shows a real starting price on a service card", () => {
    render(
      <ServiceGrid
        services={[
          {
            category: "Plumbing",
            name: "Pipe repair",
            description: "Repair a pipe.",
            startingPricePhp: 1200,
          },
        ]}
      />,
    );

    expect(screen.getByText(/^From /)).toBeInTheDocument();
  });

  test("shows at most two service portfolio photos", () => {
    render(
      <ServiceShowcase
        service={{
          id: "service-id",
          category: "Plumbing",
          name: "Leak repair",
          description: "Repair a leak.",
          starting_price_php: null,
          price_note: null,
        }}
        photos={[
          {
            id: "photo-1",
            imageUrl: "/photo-1.jpg",
            caption: "First photo",
            sort_order: 1,
          },
          {
            id: "photo-2",
            imageUrl: "/photo-2.jpg",
            caption: "Second photo",
            sort_order: 2,
          },
          {
            id: "photo-3",
            imageUrl: "/photo-3.jpg",
            caption: "Third photo",
            sort_order: 3,
          },
        ]}
        reviews={[]}
        customer={false}
      />,
    );

    expect(screen.getAllByRole("img", { name: /photo/ })).toHaveLength(2);
    expect(screen.queryByText("Third photo")).not.toBeInTheDocument();
  });
});
