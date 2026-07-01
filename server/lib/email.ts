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

interface InviteToSignupOptions {
  to: string;
  agentName: string;
  role: string;
  inviterName?: string | null;
  appUrl?: string;
}

// Invites someone WITHOUT a Gustafta account to sign up so a pending agent
// share can be applied to them. Never throws — returns the SendEmailResult.
export async function sendAgentInviteToSignup(opts: InviteToSignupOptions): Promise<SendEmailResult> {
  const roleLabel = ROLE_LABELS[opts.role] || opts.role;
  const inviter = opts.inviterName?.trim();
  const signupUrl =
    opts.appUrl ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/auth` : "");

  const intro = inviter
    ? `<b>${inviter}</b> ingin membagikan sebuah agen AI dengan kamu di Gustafta.`
    : `Seseorang ingin membagikan sebuah agen AI dengan kamu di Gustafta.`;
  const introText = inviter
    ? `${inviter} ingin membagikan sebuah agen AI dengan kamu di Gustafta.`
    : `Seseorang ingin membagikan sebuah agen AI dengan kamu di Gustafta.`;

  const ctaButton = signupUrl
    ? `<div style="text-align:center;margin:0 0 24px"><a href="${signupUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px">Daftar & Terima Akses</a></div>`
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
          <p style="font-size:16px;margin:0 0 8px">Halo,</p>
          <p style="font-size:15px;color:#374151;margin:0 0 16px">${intro}</p>
          <div style="padding:20px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 24px">
            <p style="font-size:13px;color:#6b7280;margin:0 0 4px">Nama Agen</p>
            <p style="font-size:18px;font-weight:700;color:#111;margin:0 0 16px">${opts.agentName}</p>
            <p style="font-size:13px;color:#6b7280;margin:0 0 4px">Peran Kamu</p>
            <p style="font-size:15px;font-weight:600;color:#111;margin:0">${roleLabel}</p>
          </div>
          <p style="font-size:15px;color:#374151;margin:0 0 16px">Kamu belum punya akun Gustafta. Daftar dengan alamat email ini, dan akses agen akan otomatis aktif setelah pendaftaran selesai.</p>
          ${ctaButton}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px">
          <p style="font-size:12px;color:#9ca3af;margin:0">Kamu menerima email ini karena seseorang ingin membagikan agen dengan alamat email kamu.</p>
          <p style="font-size:12px;color:#9ca3af;margin:8px 0 0">© 2025 Gustafta. Seluruh hak dilindungi.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textContent = `Halo,

${introText}

Nama Agen: ${opts.agentName}
Peran Kamu: ${roleLabel}

Kamu belum punya akun Gustafta. Daftar dengan alamat email ini, dan akses agen akan otomatis aktif setelah pendaftaran selesai.
${signupUrl ? `\nDaftar di sini: ${signupUrl}\n` : ""}
Kamu menerima email ini karena seseorang ingin membagikan agen dengan alamat email kamu.

— Tim Gustafta`;

  return sendEmail({
    to: opts.to,
    subject: `Undangan: daftar untuk mengakses agen "${opts.agentName}" di Gustafta`,
    htmlContent: html,
    textContent,
    tags: ["agent-invite", "transactional"],
  });
}

interface CertificationNotificationOptions {
  to: string;
  recipientName?: string | null;
  agentName: string;
  certified: boolean;
  appUrl?: string;
}

// Notifies a chatbot creator that an admin granted/revoked the "Bersertifikat"
// status for their agent. Never throws — returns the SendEmailResult.
export async function sendAgentCertificationNotification(opts: CertificationNotificationOptions): Promise<SendEmailResult> {
  const greetName = opts.recipientName?.trim() || "Halo";
  const dashboardUrl =
    opts.appUrl ||
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/dashboard` : "");

  const intro = opts.certified
    ? `Selamat! Chatbot kamu kini berstatus <b>Bersertifikat</b> di Gustafta Store.`
    : `Status <b>Bersertifikat</b> untuk chatbot kamu telah dicabut oleh admin.`;
  const introText = opts.certified
    ? `Selamat! Chatbot kamu kini berstatus Bersertifikat di Gustafta Store.`
    : `Status Bersertifikat untuk chatbot kamu telah dicabut oleh admin.`;
  const statusLabel = opts.certified ? "Bersertifikat" : "Dicabut";
  const statusColor = opts.certified ? "#16a34a" : "#6b7280";

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
            <p style="font-size:13px;color:#6b7280;margin:0 0 4px">Nama Chatbot</p>
            <p style="font-size:18px;font-weight:700;color:#111;margin:0 0 16px">${opts.agentName}</p>
            <p style="font-size:13px;color:#6b7280;margin:0 0 4px">Status</p>
            <p style="font-size:15px;font-weight:700;color:${statusColor};margin:0">${statusLabel}</p>
          </div>
          ${ctaButton}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px">
          <p style="font-size:12px;color:#9ca3af;margin:0">Kamu menerima email ini karena status sertifikasi chatbot di akun Gustafta kamu berubah.</p>
          <p style="font-size:12px;color:#9ca3af;margin:8px 0 0">© 2025 Gustafta. Seluruh hak dilindungi.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textContent = `Halo ${greetName},

${introText}

Nama Chatbot: ${opts.agentName}
Status: ${statusLabel}
${dashboardUrl ? `\nBuka dashboard: ${dashboardUrl}\n` : ""}
Kamu menerima email ini karena status sertifikasi chatbot di akun Gustafta kamu berubah.

— Tim Gustafta`;

  return sendEmail({
    to: opts.to,
    toName: opts.recipientName || undefined,
    subject: opts.certified
      ? `Chatbot kamu kini Bersertifikat: ${opts.agentName}`
      : `Status Bersertifikat dicabut: ${opts.agentName}`,
    htmlContent: html,
    textContent,
    tags: ["agent-certification", "transactional"],
  });
}
