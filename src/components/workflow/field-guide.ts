type Guide = { placeholder?: string; hint?: string };
const notes: Record<string, Guide> = {
  admin_review: {
    placeholder:
      "Example: Within our service area. Customer reports a kitchen sink leak. Inspection is needed to confirm the damaged part. MAZ will confirm the visit schedule.",
    hint: "Ilagay ang coverage check, issue, decision, at next step. For clarification or decline, explain what is missing or why MAZ cannot proceed.",
  },
  admin_document: {
    placeholder:
      "Scope: Replace the leaking kitchen sink trap.\nIncluded: Labor, agreed replacement part and leak testing.\nExcluded: Hidden pipe repairs and wall restoration.\nEstimated duration: One work day.\nResponsibilities / payment terms: Enter the actual agreed terms.\nFor a change order: Explain the additional work, reason, added cost and time impact.",
    hint: "Write the complete terms the customer will approve. Example only—palitan ayon sa actual project. Accepted versions cannot be edited.",
  },
  admin_verify_payment: {
    placeholder:
      "Example: Checked the MAZ bank transaction record. Received PHP 3,500 on [actual date]; reference [actual transaction reference] matches this booking.",
    hint: "Describe how you checked actual funds received. Do not approve based only on a screenshot. For rejection, explain the mismatch or missing evidence.",
  },
  admin_resolve_request: {
    placeholder:
      "Example: Cancellation approved after discussing the request with the customer. The team will be released. Any refund requires a separate review and verified settlement.",
    hint: "State approve/deny, the actual reason, and the next step. Approval of a refund request does not mean money has already been returned.",
  },
  admin_record_refund: {
    placeholder:
      "Example: Returned PHP [actual amount] through [actual channel] on [actual date]. Checked the completed transfer and confirmed the recipient matches the customer.",
    hint: "Complete this only after the manual refund was actually settled. Use the real transfer or cash acknowledgment reference in the reference field.",
  },
  customer_request: {
    placeholder:
      "Example: I would like to request a different visit date because no one will be at home. My available dates are [date/time] and [alternate date/time]. Please confirm what is available.",
    hint: "Sabihin kung ano ang kailangan mong baguhin, bakit, at preferred solution. For a refund, also select the payment and enter the requested amount.",
  },
  company_review: {
    placeholder:
      "Example: The MAZ team explained the repair clearly, arrived at the confirmed time and tested the sink before turnover. One thing they could improve is [your feedback].",
    hint: "Share your own experience with MAZ. Feedback about an individual worker belongs in the separate private feedback form.",
  },
  turnover: {
    placeholder:
      "Example: The repaired sink was tested with the MAZ team and no leak was observed. I received the care instructions. Remaining observations: [describe, if any].",
    hint: "Describe what was checked and handed over. If work still needs correction, send a dispute request before acknowledging completion.",
  },
};
export function fieldGuide(
  context: string,
  name: string,
  values: Record<string, unknown> = {},
): Guide {
  if (
    context === "admin_review" &&
    name === "note" &&
    values.decision === "clarify"
  )
    return {
      placeholder:
        "Example: Please confirm which fixture is leaking and upload a clear photo of the connection. We need these details before confirming the scope and visit.",
      hint: "List the specific missing details and what the customer should send. Do not describe the appointment as confirmed yet.",
    };
  if (
    context === "admin_review" &&
    name === "note" &&
    values.decision === "decline"
  )
    return {
      placeholder:
        "Example: MAZ cannot proceed because [actual reason, such as an address outside the service area]. We explained this to the customer. Any verified payment needs a separate refund review.",
      hint: "Explain the actual reason MAZ cannot accept this request. Cancellation does not automatically settle a refund.",
    };
  if (
    name === "note" &&
    context === "admin_resolve_request" &&
    values.approve === false
  )
    return {
      placeholder:
        "Example: We cannot approve this request because [actual reason and supporting details]. We can offer [available alternative / next step]. Please contact MAZ if clarification is needed.",
      hint: "Explain why this specific request is being denied and what the customer can do next. Do not invent a cancellation fee or refund policy.",
    };
  if (
    name === "note" &&
    context === "admin_verify_payment" &&
    values.approve === false
  )
    return {
      placeholder:
        "Example: The submitted reference does not match any received MAZ transaction. Please upload the correct proof and reference.",
      hint: "Explain the actual mismatch and what the customer needs to correct.",
    };
  if (name === "note" && context === "respond_quote")
    return {
      placeholder:
        "Example: Please clarify whether the replacement part and disposal are included. I would like to review the scope before approving.",
      hint: "Tell MAZ which price, item or scope needs clarification.",
    };
  if (name === "note" && notes[context]) return notes[context];
  if (name === "title")
    return {
      placeholder: "Example: Kitchen sink repair agreement",
      hint: "Use a short title that identifies the service or project.",
    };
  if (name === "reference")
    return {
      placeholder: "Enter the actual transaction / receipt reference",
      hint: "Copy the real reference from the completed transaction or MAZ receipt; do not use the sample text.",
    };
  if (name === "costDelta")
    return {
      hint: "Additional PHP amount for this change only. Example: 1,200 for an extra approved repair; enter 0 if no added cost.",
    };
  if (name === "daysDelta")
    return {
      hint: "Additional whole days caused by this change. Example: 2; enter 0 if the duration stays the same.",
    };
  if (name === "amount")
    return {
      hint: "Enter the PHP amount you are requesting MAZ to review, for example 1,500. It must relate to the selected payment.",
    };
  if (context === "instructions" && name === "instructions")
    return {
      placeholder:
        values.method === "cash"
          ? "Collection location: [actual MAZ office / agreed location]\nContact person: [authorized MAZ staff]\nRequest a MAZ payment acknowledgment after payment."
          : "Account name: [verified MAZ account name]\nAccount / mobile number: [verified company account]\nBank / wallet: [actual channel]\nReference to include: [booking reference]",
      hint: "Use MAZ's verified collection details only. Bracketed text is a guide, not an account to pay.",
    };
  if (context === "create" && name === "description")
    return {
      placeholder:
        "Example: Customer called about a leak under the kitchen sink. Leak appears when the tap runs. Started yesterday. Customer requests inspection; available [date/time]. Access instructions: [actual details].",
      hint: "Record the reported problem, location in the property, when it started, and the customer's instructions. The requested date is not yet confirmed.",
    };
  if (context === "moderate" && name === "note")
    return {
      placeholder:
        "Example: Unpublished because the photo shows a house number. A privacy-safe replacement must be reviewed before publication.",
      hint: "Record the actual privacy or moderation issue, or why a previous hold can be cleared.",
    };
  if (name === "start")
    return {
      hint: "Choose the customer's requested appointment in Philippine time. MAZ confirms availability separately.",
    };
  return {};
}
