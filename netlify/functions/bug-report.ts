import { withErrorHandling, jsonResponse, HttpError } from "./utils/http";
import { requireAuth, supabaseAdmin } from "./utils/supabase-admin";

export const handler = withErrorHandling(async (event) => {
  if (event.httpMethod !== 'POST') {
    throw new HttpError(405, 'Method not allowed');
  }

  const { user } = await requireAuth(event);

  // Parse multipart form data manually for Netlify Functions
  const contentType = event.headers['content-type'] || '';

  let title = '';
  let description = '';
  let appSource = '';
  let pageUrl = '';
  let browserInfo = '';
  let consoleErrors = '';
  let stepsToReproduce = '';
  let canReplicate = false;
  let screenshotBuffer: Buffer | null = null;
  let screenshotContentType = 'image/jpeg';
  let consoleScreenshotBuffer: Buffer | null = null;
  const attachmentBuffers: { data: Buffer; contentType: string; filename: string }[] = [];

  if (contentType.includes('multipart/form-data')) {
    // Parse multipart body
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) throw new HttpError(400, 'Invalid multipart request');

    const body = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'utf-8');

    const parts = parseMultipart(body, boundary);

    for (const part of parts) {
      switch (part.name) {
        case 'title': title = part.data.toString('utf-8'); break;
        case 'description': description = part.data.toString('utf-8'); break;
        case 'appSource': appSource = part.data.toString('utf-8'); break;
        case 'pageUrl': pageUrl = part.data.toString('utf-8'); break;
        case 'browserInfo': browserInfo = part.data.toString('utf-8'); break;
        case 'consoleErrors': consoleErrors = part.data.toString('utf-8'); break;
        case 'stepsToReproduce': stepsToReproduce = part.data.toString('utf-8'); break;
        case 'canReplicate': canReplicate = part.data.toString('utf-8') === 'true'; break;
        case 'screenshot':
          screenshotBuffer = part.data;
          screenshotContentType = part.contentType || 'image/jpeg';
          break;
        case 'consoleScreenshot':
          consoleScreenshotBuffer = part.data;
          break;
        case 'attachments':
          attachmentBuffers.push({
            data: part.data,
            contentType: part.contentType || 'application/octet-stream',
            filename: part.filename || 'file',
          });
          break;
      }
    }
  } else {
    // JSON fallback
    const body = JSON.parse(event.body || '{}');
    title = body.title;
    description = body.description;
    appSource = body.appSource;
    pageUrl = body.pageUrl || '';
    browserInfo = body.browserInfo || '';
    consoleErrors = body.consoleErrors || '';
    stepsToReproduce = body.stepsToReproduce || '';
    canReplicate = body.canReplicate === true;
  }

  if (!title || !description || !appSource) {
    throw new HttpError(400, 'Missing required fields');
  }

  const timestamp = Date.now();
  let screenshotUrl: string | null = null;
  const images: string[] = [];

  if (screenshotBuffer) {
    const filePath = `${user.id}/${timestamp}.jpg`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('bug-screenshots')
      .upload(filePath, screenshotBuffer, {
        contentType: screenshotContentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Screenshot upload failed:', uploadError.message);
    } else {
      const { data: urlData } = supabaseAdmin.storage
        .from('bug-screenshots')
        .getPublicUrl(filePath);
      screenshotUrl = urlData.publicUrl;
    }
  }

  if (consoleScreenshotBuffer) {
    const filePath = `${user.id}/${timestamp}_console.png`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('bug-screenshots')
      .upload(filePath, consoleScreenshotBuffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Console screenshot upload failed:', uploadError.message);
    } else {
      const { data: urlData } = supabaseAdmin.storage
        .from('bug-screenshots')
        .getPublicUrl(filePath);
      images.push(urlData.publicUrl);
    }
  }

  // Process file attachments
  for (let i = 0; i < attachmentBuffers.length && i < 5; i++) {
    const att = attachmentBuffers[i];
    if (att.data.length === 0 || att.data.length > 10 * 1024 * 1024) continue;
    const ext = att.filename.split('.').pop() || 'bin';
    const filePath = `${user.id}/${timestamp}_${i}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('bug-screenshots')
      .upload(filePath, att.data, {
        contentType: att.contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`Attachment ${i} upload failed:`, uploadError.message);
    } else {
      const { data: urlData } = supabaseAdmin.storage
        .from('bug-screenshots')
        .getPublicUrl(filePath);
      images.push(urlData.publicUrl);
    }
  }

  const { data, error } = await supabaseAdmin
    .from('bug_reports')
    .insert({
      user_id: user.id,
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
    throw new HttpError(500, 'Failed to submit bug report');
  }

  return jsonResponse(200, { success: true, data: { id: data.id } });
});

// Simple multipart form data parser
interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundary = Buffer.from(`--${boundary}--`);

  let start = body.indexOf(boundaryBuffer) + boundaryBuffer.length;

  while (start < body.length) {
    const nextBoundary = body.indexOf(boundaryBuffer, start);
    if (nextBoundary === -1) break;

    const partData = body.subarray(start, nextBoundary);
    const headerEnd = partData.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = nextBoundary + boundaryBuffer.length; continue; }

    const headerStr = partData.subarray(0, headerEnd).toString('utf-8');
    const dataStart = headerEnd + 4;
    // Remove trailing \r\n
    let dataEnd = partData.length;
    if (partData[dataEnd - 2] === 0x0d && partData[dataEnd - 1] === 0x0a) {
      dataEnd -= 2;
    }
    const data = partData.subarray(dataStart, dataEnd);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch?.[1],
        contentType: ctMatch?.[1]?.trim(),
        data,
      });
    }

    start = nextBoundary + boundaryBuffer.length;
    // Check if we hit the end boundary
    if (body.subarray(nextBoundary, nextBoundary + endBoundary.length).equals(endBoundary)) break;
  }

  return parts;
}
