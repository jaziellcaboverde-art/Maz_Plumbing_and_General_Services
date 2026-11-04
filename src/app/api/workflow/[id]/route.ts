import {
  databaseError,
  readBody,
  requireUser,
  UUID,
} from "@/lib/matching/http";
import { parseReceiptCsv } from "@/lib/workflow/receipt-import";
import { parseWorkflowAction } from "@/lib/workflow/rules";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await readBody(request);
  let actionData = body?.data;
  if (
    body?.action === "admin_quote" &&
    actionData &&
    typeof actionData === "object"
  ) {
    const receipt = actionData as Record<string, unknown>;
    try {
      const imported = parseReceiptCsv(receipt.receiptCsv as string);
      const name =
        typeof receipt.receiptName === "string"
          ? receipt.receiptName.replace(/[\r\n]/g, " ").slice(0, 160)
          : "expense-receipt.csv";
      actionData = {
        ...receipt,
        items: imported.items,
        // The database derives the actual deposit from the stored contract flag.
        deposit: 0,
        schedule: [],
        gatewayFee: 0,
        note:
          "Expense receipt imported: " +
          name +
          ". Includes the labor, materials and expenses listed in this quotation.",
      };
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Import a valid expense receipt CSV.",
        },
        { status: 400 },
      );
    }
  }
  const parsed = parseWorkflowAction(body?.action, actionData);
  if (!UUID.test(id) || !parsed)
    return Response.json(
      { error: "Check the action and required fields." },
      { status: 400 },
    );
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const rpc = [
    "admin_record_quote_decision",
    "admin_record_document_decision",
  ].includes(parsed.action)
    ? "admin_record_manual_decision"
    : "managed_booking_action";
  const { data, error } = await auth.session.rpc(rpc, {
    p_booking: id,
    p_action: parsed.action,
    p_data: parsed.data,
  });
  if (error)
    return databaseError(
      error,
      "Could not save this action. Please refresh and try again.",
    );
  return Response.json(data ?? { ok: true });
}
