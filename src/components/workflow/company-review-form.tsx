import { ActionForm } from "./action-form";
import { canEditCompanyReview } from "@/lib/workflow/rules";

export type CompanyReview = {
  stars: number;
  comment: string | null;
  created_at: string;
  publish: boolean;
  attribution: string;
};

export function CompanyReviewForm({
  bookingId,
  review,
}: {
  bookingId: string;
  review?: CompanyReview | null;
}) {
  if (review && !canEditCompanyReview(review.created_at))
    return <p>The 14-day review edit period has ended.</p>;
  return (
    <ActionForm
      bookingId={bookingId}
      action="company_review"
      label={review ? "Save MAZ review changes" : "Submit MAZ review"}
      fields={[
        {
          name: "stars",
          label: "Your rating for MAZ",
          type: "select",
          required: true,
          value: review?.stars ?? 5,
          options: [1, 2, 3, 4, 5].map((value) => ({
            value: String(value),
            label: `${value} out of 5`,
          })),
        },
        {
          name: "note",
          label: "Company review",
          type: "textarea",
          value: review?.comment ?? "",
        },
        {
          name: "publish",
          label: "I allow publication of my MAZ rating and review",
          type: "checkbox",
          value: review?.publish ?? false,
        },
        {
          name: "attribution",
          label: "Public attribution",
          type: "select",
          value: review?.attribution ?? "anonymous",
          options: [
            { value: "anonymous", label: "Anonymous" },
            { value: "first_name", label: "First name only" },
            { value: "no_quote", label: "Rating only, no review quote" },
          ],
        },
      ]}
    />
  );
}
