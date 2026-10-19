export type NotificationEmailContent = {
  title: string;
  body?: string;
  actionUrl?: string;
};

export type RenderedNotificationEmail = {
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

/** One shared, email-client friendly layout plus a readable plain-text version. */
export function renderNotificationEmail(content: NotificationEmailContent): RenderedNotificationEmail {
  const titleText = content.title.trim();
  const bodyText = content.body?.trim() ?? "";
  const title = escapeHtml(titleText);
  const body = bodyText
    ? `<p style="margin:0 0 24px;color:#343a46;font-size:16px;line-height:1.6;white-space:pre-line">${escapeHtml(bodyText)}</p>`
    : "";
  const actionUrl = content.actionUrl ? escapeHtml(content.actionUrl) : "";
  const action = actionUrl
    ? `<p style="margin:28px 0 0"><a href="${actionUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1d2e63;color:#fff;font-size:16px;font-weight:600;text-decoration:none">Open MAZ Plumbing and General Services</a></p>`
    : "";
  const text = [titleText, bodyText, content.actionUrl ? `Open MAZ Plumbing and General Services: ${content.actionUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");

  return {
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
  <body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f8;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e1e4ea;border-radius:12px">
          <tr><td style="padding:24px 28px;border-bottom:1px solid #e1e4ea;color:#1d2e63;font-size:18px;font-weight:700">MAZ Plumbing and General Services</td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 16px;color:#171a21;font-size:24px;line-height:1.3">${title}</h1>
            ${body}
            ${action}
          </td></tr>
          <tr><td style="padding:18px 28px;border-top:1px solid #e1e4ea;color:#687080;font-size:13px;line-height:1.5">This is a service message from MAZ Plumbing and General Services.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    text,
  };
}
