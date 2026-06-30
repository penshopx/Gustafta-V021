// Reusable transactional email helper (Brevo).
// Gracefully degrades when BREVO_API_KEY is absent: logs in dev, never crashes.

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "api_error" | "network_error"; detail?: string };

interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  tags?: string[];
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (!brevoApiKey) {
    console.log(`[Email] BREVO_API_KEY not set — skipping email "${opts.subject}" to ${opts.to}`);
    return { sent: false, reason: "not_configured" };
  }
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@gustafta.com";

  try {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Gustafta", email: senderEmail },
        replyTo: { name: "Gustafta Support", email: "support@gustafta.com" },
        to: [{ email: opts.to, name: opts.toName || opts.to }],
        subject: opts.subject,
        htmlContent: opts.htmlContent,
        textContent: opts.textContent,
        tags: opts.tags || ["transactional"],
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[Email] Brevo API error sending to ${opts.to}: HTTP ${resp.status} — ${errBody}`);
      return { sent: false, reason: "api_error", detail: `HTTP ${resp.status}: ${errBody.slice(0, 300)}` };
    }
    console.log(`[Email] Sent "${opts.subject}" to ${opts.to} via Brevo (sender: ${senderEmail})`);
    return { sent: true };
  } catch (err: any) {
    const detail = err?.message || String(err);
    console.error(`[Email] Network/send error for ${opts.to}: ${detail}`);
    return { sent: false, reason: "network_error", detail };
  }
}

const ROLE_LABELS: Record<string, string> = {
  editor: "Editor (dapat mengubah agen)",
  viewer: "Viewer (hanya dapat melihat & menggunakan)",
};

interface ShareNotificationOptions {
  to: string;
  recipientName?: string | null;
  agentName: string;
  role: string;
  inviterName?: string | null;
  appUrl?: string;
}

// Notifies a user that an agent has been shared with them.
// Never throws — returns the underlying SendEmailResult.
export async function sendAgentShareNotification(opts: ShareNotificationOptions): Promise<SendEmailResult> {
  const roleLabel = ROLE_LABELS[opts.role] || opts.role;
  const greetName = opts.recipientName?.trim() || "Halo";
  const inviter = opts.inviterName?.trim();
  const dashboardUrl =
    opts.appUrl ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/dashboard` : "");

  const intro = inviter
    ? `<b>${inviter}</b> membagikan sebuah agen AI dengan kamu di Gustafta.`
    : `Sebuah agen AI telah dibagikan dengan kamu di Gustafta.`;
  const introText = inviter
    ? `${inviter} membagikan sebuah agen AI dengan kamu di Gustafta.`
    : `Sebuah agen AI telah dibagikan dengan kamu di Gustafta.`;

  const ctaButton = dashboardUrl
    ? `<div style="text-align:center;margin:0 0 24px"><a href="${dashboardUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px">Buka Dashboard</a></div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:40px;font-family:Arial,sans-serif;color:#111">
        <tr><td>
          <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#6366f1">Gustafta</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
          <p style="font-size:16px;margin:0 0 8px">Halo <b>${greetName}</b>,</p>
          <p style="font-size:15px;color:#374151;margin:0 0 16px">${intro}</p>
          <div style="padding:20px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 24px">
            <p style="font-size:13px;color:#6b7280;margin:0 0 4px">Nama Agen</p>
            <p style="font-size:18px;font-weight:700;color:#111;margin:0 0 16px">${opts.agentName}</p>
            <p style="font-size:13px;color:#6b7280;margin:0 0 4px">Peran Kamu</p>
            <p style="font-size:15px;font-weight:600;color:#111;margin:0">${roleLabel}</p>
          </div>
          ${ctaButton}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px">
          <p style="font-size:12px;color:#9ca3af;margin:0">Kamu menerima email ini karena seseorang membagikan agen dengan akun Gustafta kamu.</p>
          <p style="font-size:12px;color:#9ca3af;margin:8px 0 0">© 2025 Gustafta. Seluruh hak dilindungi.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textContent = `Halo ${greetName},

${introText}

Nama Agen: ${opts.agentName}
Peran Kamu: ${roleLabel}
${dashboardUrl ? `\nBuka dashboard: ${dashboardUrl}\n` : ""}
Kamu menerima email ini karena seseorang membagikan agen dengan akun Gustafta kamu.

— Tim Gustafta`;

  return sendEmail({
    to: opts.to,
    toName: opts.recipientName || undefined,
    subject: `Sebuah agen dibagikan dengan kamu: ${opts.agentName}`,
    htmlContent: html,
    textContent,
    tags: ["agent-share", "transactional"],
  });
}
