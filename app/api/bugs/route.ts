import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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
        const { data: urlData } = supabase.storage
          .from('bug-screenshots')
          .getPublicUrl(filePath);
        screenshotUrl = urlData.publicUrl;
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
        const { data: urlData } = supabase.storage
          .from('bug-screenshots')
          .getPublicUrl(filePath);
        images.push(urlData.publicUrl);
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
        const { data: urlData } = supabase.storage
          .from('bug-screenshots')
          .getPublicUrl(filePath);
        images.push(urlData.publicUrl);
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

    return NextResponse.json({ success: true, data: { id: data.id } });
  } catch (err) {
    console.error('Bug report error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
