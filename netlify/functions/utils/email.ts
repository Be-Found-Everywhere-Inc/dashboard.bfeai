import { Resend } from "resend";
import { buildTrialReminderHtml, buildTrialReminderText, buildWelcomeEmailHtml, buildWelcomeEmailText } from "./email-templates";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "BFEAI <noreply@bfeai.com>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

/**
 * Generic transactional email sender. Used by Wave 2 endpoints (e.g.
 * credits-skipped-scan-notify) where the caller has already rendered the
 * subject/html/text via a dedicated template helper. Fire-and-forget: never
 * throws, logs errors. Returns `{ success: false }` when RESEND_API_KEY is
 * missing or when Resend rejects the send so the caller can surface a soft
 * failure without breaking the request.
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<{ success: boolean }> {
  try {
    if (!resendApiKey) {
      console.warn(
        "[email] RESEND_API_KEY not configured, logging email instead"
      );
      console.log("[email] Email would be sent to:", params.to, {
        subject: params.subject,
      });
      return { success: false };
    }

    const resend = new Resend(resendApiKey);

    const { error } = await resend.emails.send({
      from: params.from ?? fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return { success: false };
    }

    console.log(`[email] Email sent to ${params.to}: ${params.subject}`);
    return { success: true };
  } catch (error) {
    console.error("[email] Failed to send email:", error);
    return { success: false };
  }
}

interface TrialReminderData {
  userName: string;
  appName: string;
  chargeDate: string;
  chargeAmount: string;
  cancellationUrl: string;
}

/**
 * Send a branded trial reminder email via Resend.
 * Fire-and-forget: never throws, logs errors.
 */
export async function sendTrialReminderEmail(
  to: string,
  data: TrialReminderData
): Promise<{ success: boolean }> {
  try {
    if (!resendApiKey) {
      console.warn("[email] RESEND_API_KEY not configured, logging email instead");
      console.log("[email] Trial reminder would be sent to:", to, data);
      return { success: false };
    }

    const resend = new Resend(resendApiKey);

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Your ${data.appName} trial ends soon`,
      html: buildTrialReminderHtml(data),
      text: buildTrialReminderText(data),
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return { success: false };
    }

    console.log(`[email] Trial reminder sent to ${to} for ${data.appName}`);
    return { success: true };
  } catch (error) {
    console.error("[email] Failed to send trial reminder:", error);
    return { success: false };
  }
}

interface WelcomeEmailData {
  appName: string;
  resetLink: string;
  trialDays: number;
  chargeAmount: string;
}

/**
 * Send a branded welcome email to a new user who signed up via public trial checkout.
 * Fire-and-forget: never throws, logs errors.
 */
export async function sendWelcomeEmail(
  to: string,
  data: WelcomeEmailData
): Promise<{ success: boolean }> {
  try {
    if (!resendApiKey) {
      console.warn("[email] RESEND_API_KEY not configured, logging email instead");
      console.log("[email] Welcome email would be sent to:", to, data);
      return { success: false };
    }

    const resend = new Resend(resendApiKey);

    const { error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Welcome to BFEAI — set your password to get started`,
      html: buildWelcomeEmailHtml(data),
      text: buildWelcomeEmailText(data),
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return { success: false };
    }

    console.log(`[email] Welcome email sent to ${to} for ${data.appName}`);
    return { success: true };
  } catch (error) {
    console.error("[email] Failed to send welcome email:", error);
    return { success: false };
  }
}
