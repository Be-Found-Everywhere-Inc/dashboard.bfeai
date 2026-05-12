import { Resend } from "resend";
import { renderStandardWelcomeEmail } from "@/netlify/functions/utils/email-templates";

interface StandardWelcomeArgs {
  to: string;
  firstName?: string;
  dashboardUrl?: string;
}

/**
 * Send the welcome email for users who signed up via the standard auth flow
 * (email form or OAuth provider). Fire-and-forget: never throws and never
 * blocks the auth response. Returns `{ success: false }` if Resend isn't
 * configured or rejects the send.
 *
 * Distinct from `sendWelcomeEmail` in `netlify/functions/utils/email.ts`,
 * which is for the unauthenticated Stripe-trial flow and requires a
 * password-reset link.
 */
export async function sendStandardWelcomeEmail(
  args: StandardWelcomeArgs,
): Promise<{ success: boolean }> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        "[email] RESEND_API_KEY not configured, logging welcome email instead",
      );
      console.log("[email] Standard welcome email would be sent to:", args.to);
      return { success: false };
    }

    const dashboardUrl =
      args.dashboardUrl ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://dashboard.bfeai.com";

    const { subject, html, text } = renderStandardWelcomeEmail({
      firstName: args.firstName,
      dashboardUrl,
    });

    const resend = new Resend(apiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? '"Bill from BFEAI" <bill@noreply.bfeai.com>';

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: args.to,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[email] Resend error sending standard welcome:", error);
      return { success: false };
    }

    console.log(`[email] Standard welcome email sent to ${args.to}`);
    return { success: true };
  } catch (error) {
    console.error("[email] Failed to send standard welcome email:", error);
    return { success: false };
  }
}
