interface TrialReminderData {
  userName: string;
  appName: string;
  chargeDate: string;
  chargeAmount: string;
  cancellationUrl: string;
}

/**
 * Build branded HTML email for trial ending reminder.
 */
export function buildTrialReminderHtml(data: TrialReminderData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your trial is ending soon</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#533577,#454D9A);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">BFEAI</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Be Found Everywhere AI</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.6;">
                Hi ${escapeHtml(data.userName)},
              </p>
              <p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.6;">
                Your trial of <strong>${escapeHtml(data.appName)}</strong> is ending soon. Here are the details:
              </p>

              <!-- Details box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fc;border-radius:8px;border:1px solid #e5e7eb;margin:24px 0;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;color:#666;font-size:14px;">First charge date:</td>
                        <td style="padding:8px 0;color:#333;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(data.chargeDate)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#666;font-size:14px;">Amount:</td>
                        <td style="padding:8px 0;color:#333;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(data.chargeAmount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;color:#333;font-size:16px;line-height:1.6;">
                You'll be charged <strong>${escapeHtml(data.chargeAmount)}</strong> on <strong>${escapeHtml(data.chargeDate)}</strong> unless you cancel. No action is needed if you'd like to continue.
              </p>

              <p style="margin:0 0 24px;color:#333;font-size:16px;line-height:1.6;">
                If you'd prefer not to be charged, you can cancel anytime before the trial ends:
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#533577;border-radius:6px;">
                    <a href="${escapeHtml(data.cancellationUrl)}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">
                      Manage Subscription
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f8f9fc;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#999;font-size:12px;line-height:1.5;">
                You're receiving this email because you signed up for a trial on BFEAI.
                <br>
                <a href="${escapeHtml(data.cancellationUrl)}" style="color:#533577;text-decoration:underline;">Manage your subscription</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build plain text fallback for trial ending reminder.
 */
export function buildTrialReminderText(data: TrialReminderData): string {
  return `Hi ${data.userName},

Your trial of ${data.appName} is ending soon.

First charge date: ${data.chargeDate}
Amount: ${data.chargeAmount}

You'll be charged ${data.chargeAmount} on ${data.chargeDate} unless you cancel. No action is needed if you'd like to continue.

To cancel before you're charged, visit: ${data.cancellationUrl}

— The BFEAI Team`;
}

// ---------------------------------------------------------------------------
// Welcome email (unauthenticated trial sign-up)
// ---------------------------------------------------------------------------

interface WelcomeEmailData {
  appName: string;
  resetLink: string;
  trialDays: number;
  chargeAmount: string;
}

/**
 * Build branded HTML email welcoming a new user who signed up via public trial checkout.
 */
export function buildWelcomeEmailHtml(data: WelcomeEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to BFEAI</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#533577,#454D9A);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">BFEAI</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Be Found Everywhere AI</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.6;">
                Welcome to BFEAI!
              </p>
              <p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.6;">
                Your <strong>${escapeHtml(String(data.trialDays))}-day trial</strong> of <strong>${escapeHtml(data.appName)}</strong> is now active. To get started, set your password below:
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
                <tr>
                  <td style="background-color:#533577;border-radius:6px;">
                    <a href="${escapeHtml(data.resetLink)}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Details box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fc;border-radius:8px;border:1px solid #e5e7eb;margin:24px 0;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;color:#666;font-size:14px;">Trial period:</td>
                        <td style="padding:8px 0;color:#333;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(String(data.trialDays))} days</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#666;font-size:14px;">After trial:</td>
                        <td style="padding:8px 0;color:#333;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(data.chargeAmount)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;color:#333;font-size:16px;line-height:1.6;">
                You can cancel anytime during your trial and won't be charged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f8f9fc;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#999;font-size:12px;line-height:1.5;">
                You're receiving this email because you started a trial on BFEAI.
                <br>
                <a href="https://dashboard.bfeai.com/billing" style="color:#533577;text-decoration:underline;">Manage your subscription</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build plain text fallback for welcome email.
 */
export function buildWelcomeEmailText(data: WelcomeEmailData): string {
  return `Welcome to BFEAI!

Your ${data.trialDays}-day trial of ${data.appName} is now active.

Set your password to get started: ${data.resetLink}

Trial period: ${data.trialDays} days
After trial: ${data.chargeAmount}

You can cancel anytime during your trial and won't be charged.

Manage your subscription: https://dashboard.bfeai.com/billing

— The BFEAI Team`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Scheduled scan skipped (low credits)
// ---------------------------------------------------------------------------

interface ScheduledScanSkippedData {
  firstName?: string;
  appName: string;
  requiredCredits: number;
  availableCredits: number;
  creditsUrl: string;
}

/**
 * Strip control characters (NUL, BEL, BS, VT, FF, CRs, DEL, etc.) from a
 * string. `\t` (0x09) and `\n` (0x0A) are preserved so multi-line plain-text
 * bodies still render. Used to defend against header injection in email
 * subjects and against log/output manipulation in plain-text bodies where
 * HTML escaping would be wrong.
 */
const stripControl = (s: string): string =>
  s.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, "");

/**
 * Render the "your scheduled scan was skipped" email sent when a scheduled
 * run can't fire because the user is short on credits. Throttled to at most
 * once per 24h per user/app via shouldSendEmail() at the call site.
 */
export function renderScheduledScanSkippedEmail(
  params: ScheduledScanSkippedData
): { subject: string; html: string; text: string } {
  const greetingHtml = params.firstName
    ? `Hi ${escapeHtml(params.firstName)},`
    : "Hi there,";
  const appNameHtml = escapeHtml(params.appName);
  const creditsUrlHtml = escapeHtml(params.creditsUrl);
  const required = String(params.requiredCredits);
  const available = String(params.availableCredits);

  // Defense-in-depth: strip CRLF/control bytes from values that flow into
  // the Subject header and plain-text body. Resend likely re-encodes
  // headers, but this prevents header injection if a backend ever passes
  // these straight through.
  const safeAppName = stripControl(params.appName);
  const safeFirstName = params.firstName
    ? stripControl(params.firstName)
    : undefined;
  const safeCreditsUrl = stripControl(params.creditsUrl);

  const subject = `Your ${safeAppName} scheduled scan was skipped — top up to resume`;

  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.55;max-width:560px;margin:0 auto;padding:24px">
  <p>${greetingHtml}</p>
  <p>We tried to run your scheduled ${appNameHtml} scan but you didn't have enough credits.</p>
  <p>The scan needed <strong>${required}</strong> credits and your balance was <strong>${available}</strong>.</p>
  <p>Top up to resume scheduled scans:</p>
  <p><a href="${creditsUrlHtml}" style="display:inline-block;padding:10px 18px;background:#533577;color:#fff;border-radius:8px;text-decoration:none">Manage credits</a></p>
  <p style="font-size:12px;color:#666;margin-top:32px">You'll get this email at most once per 24 hours per app.</p>
</body></html>`;

  const plainGreeting = safeFirstName
    ? `Hi ${safeFirstName},`
    : "Hi there,";
  const text = `${plainGreeting}

We tried to run your scheduled ${safeAppName} scan but you didn't have enough credits.
Needed: ${required}. Available: ${available}.

Manage credits: ${safeCreditsUrl}

You'll get this email at most once per 24 hours per app.`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Auto-topup emails (Wave 3)
// ---------------------------------------------------------------------------

interface AutoTopUpEmailData {
  firstName?: string;
  packName: string;
  packPriceCents: number;
  creditsUrl: string;
}

interface AutoTopUpRefundData {
  chargeId: string;
  userId: string;
  creditsClawedBack: number;
}

/**
 * Render the "auto top-up needs your card to be confirmed" email.
 * Sent when an off-session PaymentIntent returns `requires_action` (e.g. 3DS).
 * The user's auto_topup is disabled with reason='requires_authentication';
 * they must re-confirm a card on /credits to re-enable. Throttled 24h.
 */
export function renderAutoTopUpRequiresAuthEmail(
  params: AutoTopUpEmailData,
): { subject: string; html: string; text: string } {
  const greetingHtml = params.firstName
    ? `Hi ${escapeHtml(params.firstName)},`
    : "Hi there,";
  const packNameHtml = escapeHtml(params.packName);
  const creditsUrlHtml = escapeHtml(params.creditsUrl);
  const priceUsd = (params.packPriceCents / 100).toFixed(2);

  const safePackName = stripControl(params.packName);
  const safeFirstName = params.firstName ? stripControl(params.firstName) : undefined;
  const safeCreditsUrl = stripControl(params.creditsUrl);

  const subject = `Your auto top-up needs you to confirm — re-enable on the credits page`;

  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.55;max-width:560px;margin:0 auto;padding:24px">
  <p>${greetingHtml}</p>
  <p>We tried to auto-charge $${priceUsd} for the <strong>${packNameHtml}</strong> pack, but your card needs an extra confirmation step (3D Secure).</p>
  <p>Auto top-up is paused on your account. Open the credits page and re-confirm your card to turn it back on:</p>
  <p><a href="${creditsUrlHtml}" style="display:inline-block;padding:10px 18px;background:#533577;color:#fff;border-radius:8px;text-decoration:none">Re-enable auto top-up</a></p>
  <p style="font-size:12px;color:#666;margin-top:32px">You'll get this email at most once per 24 hours.</p>
</body></html>`;

  const plainGreeting = safeFirstName ? `Hi ${safeFirstName},` : "Hi there,";
  const text = `${plainGreeting}

We tried to auto-charge $${priceUsd} for the ${safePackName} pack, but your card needs an extra confirmation step (3D Secure).

Auto top-up is paused. Re-enable it: ${safeCreditsUrl}

You'll get this email at most once per 24 hours.`;

  return { subject, html, text };
}

/**
 * Render the "auto top-up declined" email. Sent when an off-session PaymentIntent
 * returns `card_declined`. auto_topup disabled with reason='card_declined';
 * user must update their card on /credits. Throttled 24h.
 */
export function renderAutoTopUpCardDeclinedEmail(
  params: AutoTopUpEmailData,
): { subject: string; html: string; text: string } {
  const greetingHtml = params.firstName
    ? `Hi ${escapeHtml(params.firstName)},`
    : "Hi there,";
  const packNameHtml = escapeHtml(params.packName);
  const creditsUrlHtml = escapeHtml(params.creditsUrl);
  const priceUsd = (params.packPriceCents / 100).toFixed(2);

  const safePackName = stripControl(params.packName);
  const safeFirstName = params.firstName ? stripControl(params.firstName) : undefined;
  const safeCreditsUrl = stripControl(params.creditsUrl);

  const subject = `Auto top-up failed — please update your card`;

  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.55;max-width:560px;margin:0 auto;padding:24px">
  <p>${greetingHtml}</p>
  <p>We tried to auto-charge $${priceUsd} for the <strong>${packNameHtml}</strong> pack, but your card was declined.</p>
  <p>Auto top-up is disabled until you update your payment method. Open the credits page to fix:</p>
  <p><a href="${creditsUrlHtml}" style="display:inline-block;padding:10px 18px;background:#533577;color:#fff;border-radius:8px;text-decoration:none">Update payment method</a></p>
  <p style="font-size:12px;color:#666;margin-top:32px">You'll get this email at most once per 24 hours.</p>
</body></html>`;

  const plainGreeting = safeFirstName ? `Hi ${safeFirstName},` : "Hi there,";
  const text = `${plainGreeting}

We tried to auto-charge $${priceUsd} for the ${safePackName} pack, but your card was declined.

Auto top-up is disabled. Update your payment method: ${safeCreditsUrl}

You'll get this email at most once per 24 hours.`;

  return { subject, html, text };
}

/**
 * Render the "refund processed" admin notification. Sent when a charge.refunded
 * webhook fires for a top-up purchase and the clawback succeeds. Admin-facing,
 * not user-facing; routed to the admin email address.
 */
export function renderAutoTopUpRefundProcessedEmail(
  params: AutoTopUpRefundData,
): { subject: string; html: string; text: string } {
  const safeChargeId = stripControl(params.chargeId);
  const safeUserId = stripControl(params.userId);
  const credits = String(params.creditsClawedBack);

  const subject = `[BFEAI admin] Refund processed for charge ${safeChargeId}`;

  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.55;max-width:560px;margin:0 auto;padding:24px">
  <p>A top-up purchase was refunded and the clawback completed.</p>
  <ul>
    <li>Charge: <code>${escapeHtml(params.chargeId)}</code></li>
    <li>User: <code>${escapeHtml(params.userId)}</code></li>
    <li>Credits clawed back: <strong>${credits}</strong></li>
  </ul>
  <p>topup_balance was decremented and a <code>refund_clawback</code> transaction was logged. If the user's balance went negative, they will not be blocked but should be reviewed.</p>
</body></html>`;

  const text = `A top-up purchase was refunded; clawback completed.

Charge: ${safeChargeId}
User: ${safeUserId}
Credits clawed back: ${credits}

topup_balance decremented; refund_clawback transaction logged. If the user's balance went negative, no block — manual review recommended.`;

  return { subject, html, text };
}
