import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Resend } from 'resend';
import { JWTService } from '@/lib/auth/jwt';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('bfeai_session');

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const payload = JWTService.verifySSOToken(sessionCookie.value);
    const userId = payload.userId;

    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const appSource = formData.get('appSource') as string;
    const pageUrl = formData.get('pageUrl') as string;
    const browserInfo = formData.get('browserInfo') as string;
    const consoleErrors = formData.get('consoleErrors') as string;
    const stepsToReproduce = formData.get('stepsToReproduce') as string | null;
    const canReplicate = formData.get('canReplicate') === 'true';
    const screenshotFile = formData.get('screenshot') as File | null;
    const consoleScreenshotFile = formData.get('consoleScreenshot') as File | null;

    if (!title || !description || !appSource) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const timestamp = Date.now();
    let screenshotUrl: string | null = null;
    const images: string[] = [];

    // Upload screenshot if provided
    if (screenshotFile) {
      const filePath = `${userId}/${timestamp}.jpg`;
      const arrayBuffer = await screenshotFile.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('bug-screenshots')
        .upload(filePath, arrayBuffer, {
          contentType: screenshotFile.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Screenshot upload failed:', uploadError.message);
      } else {
        const { data: urlData } = await supabase.storage
          .from('bug-screenshots')
          .createSignedUrl(filePath, 31536000); // 1 year
        if (urlData?.signedUrl) screenshotUrl = urlData.signedUrl;
      }
    }

    // Upload console screenshot if provided
    if (consoleScreenshotFile) {
      const filePath = `${userId}/${timestamp}_console.png`;
      const arrayBuffer = await consoleScreenshotFile.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('bug-screenshots')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/png',
          upsert: false,
        });

      if (uploadError) {
        console.error('Console screenshot upload failed:', uploadError.message);
      } else {
        const { data: urlData } = await supabase.storage
          .from('bug-screenshots')
          .createSignedUrl(filePath, 31536000); // 1 year
        if (urlData?.signedUrl) images.push(urlData.signedUrl);
      }
    }

    // Process file attachments
    const attachmentFiles = formData.getAll('attachments') as File[];
    for (let i = 0; i < attachmentFiles.length; i++) {
      const file = attachmentFiles[i];
      if (!file || file.size === 0 || file.size > 10 * 1024 * 1024) continue;
      const ext = file.name.split('.').pop() || 'bin';
      const filePath = `${userId}/${timestamp}_${i}.${ext}`;
      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('bug-screenshots')
        .upload(filePath, arrayBuffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        console.error(`Attachment ${i} upload failed:`, uploadError.message);
      } else {
        const { data: urlData } = await supabase.storage
          .from('bug-screenshots')
          .createSignedUrl(filePath, 31536000); // 1 year
        if (urlData?.signedUrl) images.push(urlData.signedUrl);
      }
    }

    // Insert bug report
    const { data, error } = await supabase
      .from('bug_reports')
      .insert({
        user_id: userId,
        title,
        description,
        steps_to_reproduce: stepsToReproduce || null,
        can_replicate: canReplicate,
        app_source: appSource,
        screenshot_url: screenshotUrl,
        images: images.length > 0 ? images : undefined,
        console_errors: consoleErrors ? JSON.parse(consoleErrors) : null,
        browser_info: browserInfo ? JSON.parse(browserInfo) : null,
        page_url: pageUrl || null,
        assigned_to: 'bill@bfeai.com',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Bug report insert error:', error);
      return NextResponse.json({ error: 'Failed to submit bug report' }, { status: 500 });
    }

    // Fire-and-forget: email notification to admin
    sendBugReportEmail({
      bugId: data.id,
      title,
      description,
      appSource,
      pageUrl,
      stepsToReproduce: stepsToReproduce || null,
      canReplicate,
      browserInfo: browserInfo ? JSON.parse(browserInfo) : null,
      consoleErrors: consoleErrors ? JSON.parse(consoleErrors) : null,
      screenshotUrl,
      images,
    }).catch((err) => console.error('[email] Bug report notification failed:', err));

    return NextResponse.json({ success: true, data: { id: data.id } });
  } catch (err) {
    console.error('Bug report error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface BugReportEmailData {
  bugId: string;
  title: string;
  description: string;
  appSource: string;
  pageUrl: string | null;
  stepsToReproduce: string | null;
  canReplicate: boolean;
  browserInfo: Record<string, string> | null;
  consoleErrors: Array<{ level: string; message: string }> | null;
  screenshotUrl: string | null;
  images: string[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendBugReportEmail(data: BugReportEmailData): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('[email] RESEND_API_KEY not configured, skipping bug report notification');
    return;
  }

  const resend = new Resend(resendApiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'BFEAI <noreply@bfeai.com>';
  const adminUrl = `https://admin.bfeai.com/bugs?card=${data.bugId}`;

  // Build attachments from image URLs
  const attachments: Array<{ path: string; filename: string }> = [];

  if (data.screenshotUrl) {
    attachments.push({ path: data.screenshotUrl, filename: 'screenshot.jpg' });
  }

  data.images.forEach((url, i) => {
    const ext = url.split('.').pop()?.split('?')[0] || 'png';
    const isConsole = url.includes('_console.');
    const name = isConsole ? `console-errors.${ext}` : `attachment-${i + 1}.${ext}`;
    attachments.push({ path: url, filename: name });
  });

  // Build optional sections
  const stepsSection = data.stepsToReproduce
    ? `<tr>
        <td style="padding:8px 0;color:#666;font-size:14px;vertical-align:top;">Steps to Reproduce:</td>
        <td style="padding:8px 0;color:#333;font-size:14px;white-space:pre-wrap;">${escapeHtml(data.stepsToReproduce)}</td>
      </tr>`
    : '';

  const browserSection = data.browserInfo
    ? `<tr>
        <td style="padding:8px 0;color:#666;font-size:14px;vertical-align:top;">Browser:</td>
        <td style="padding:8px 0;color:#333;font-size:14px;">
          ${data.browserInfo.platform || 'Unknown'}<br>
          ${data.browserInfo.viewport || ''}<br>
          <span style="font-size:12px;color:#999;">${escapeHtml((data.browserInfo.userAgent || '').slice(0, 120))}</span>
        </td>
      </tr>`
    : '';

  const consoleSection = data.consoleErrors && data.consoleErrors.length > 0
    ? `<tr>
        <td style="padding:8px 0;color:#666;font-size:14px;vertical-align:top;">Console Errors:</td>
        <td style="padding:8px 0;color:#333;font-size:13px;font-family:monospace;">
          ${data.consoleErrors.slice(0, 10).map(e =>
            `<div style="margin-bottom:4px;padding:4px 8px;background:#fef2f2;border-radius:4px;">[${escapeHtml(e.level || 'error')}] ${escapeHtml((e.message || '').slice(0, 200))}</div>`
          ).join('')}
        </td>
      </tr>`
    : '';

  const imagePreviewSection = data.screenshotUrl
    ? `<div style="margin-top:24px;">
        <p style="color:#666;font-size:14px;margin:0 0 8px;">Page Screenshot:</p>
        <img src="${escapeHtml(data.screenshotUrl)}" alt="Bug screenshot" style="max-width:100%;border:1px solid #e5e7eb;border-radius:8px;" />
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bug Report: ${escapeHtml(data.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#533577,#454D9A);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">BFEAI Bug Report</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">New bug from ${escapeHtml(data.appSource)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#333;font-size:20px;font-weight:700;">${escapeHtml(data.title)}</h2>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fc;border-radius:8px;border:1px solid #e5e7eb;margin:0 0 24px;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 0;color:#666;font-size:14px;">App:</td>
                        <td style="padding:8px 0;color:#333;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(data.appSource)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#666;font-size:14px;">Can Replicate:</td>
                        <td style="padding:8px 0;color:#333;font-size:14px;font-weight:600;text-align:right;">${data.canReplicate ? 'Yes' : 'No'}</td>
                      </tr>
                      ${data.pageUrl ? `<tr>
                        <td style="padding:8px 0;color:#666;font-size:14px;">Page URL:</td>
                        <td style="padding:8px 0;font-size:14px;text-align:right;"><a href="${escapeHtml(data.pageUrl)}" style="color:#454D9A;">${escapeHtml(data.pageUrl)}</a></td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;color:#666;font-size:14px;font-weight:600;">Description:</p>
              <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.description)}</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${stepsSection}
                ${browserSection}
                ${consoleSection}
              </table>

              ${imagePreviewSection}

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px auto 0;">
                <tr>
                  <td style="background-color:#533577;border-radius:6px;">
                    <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;">
                      View in Dev Board
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
                This is an automated notification from the BFEAI Bug Report system.
                <br>
                <a href="${escapeHtml(adminUrl)}" style="color:#533577;text-decoration:underline;">Open in Admin</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain text fallback
  const text = `BFEAI Bug Report: ${data.title}

App: ${data.appSource}
Can Replicate: ${data.canReplicate ? 'Yes' : 'No'}
${data.pageUrl ? `Page URL: ${data.pageUrl}` : ''}

Description:
${data.description}
${data.stepsToReproduce ? `\nSteps to Reproduce:\n${data.stepsToReproduce}` : ''}
${data.consoleErrors?.length ? `\nConsole Errors:\n${data.consoleErrors.slice(0, 10).map(e => `[${e.level}] ${e.message}`).join('\n')}` : ''}

View in Dev Board: ${adminUrl}

— BFEAI Bug Report System`;

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: 'bill@bfeai.com',
    subject: `[Bug] ${data.title} — ${data.appSource}`,
    html,
    text,
    ...(attachments.length > 0 ? { attachments } : {}),
  });

  if (error) {
    console.error('[email] Resend bug notification error:', error);
  } else {
    console.log(`[email] Bug report notification sent for bug ${data.bugId}`);
  }
}
