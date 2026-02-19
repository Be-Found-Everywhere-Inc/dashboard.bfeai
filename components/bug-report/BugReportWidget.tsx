'use client';

import { useState, useRef, useCallback } from 'react';
import { Bug, X, Camera, Loader2, CheckCircle, Terminal, Paperclip } from 'lucide-react';
import { useConsoleCapture } from './useConsoleCapture';
import { renderConsoleImage } from './renderConsoleImage';

interface BugReportWidgetProps {
  appSource: 'accounts' | 'keywords' | 'payments';
}

const API_URL = '/api/bugs';

export function BugReportWidget({ appSource }: BugReportWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [consoleScreenshot, setConsoleScreenshot] = useState<Blob | null>(null);
  const [consoleScreenshotPreview, setConsoleScreenshotPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [canReplicate, setCanReplicate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const { getConsoleErrors } = useConsoleCapture();

  const captureScreenshot = useCallback(async () => {
    try {
      const { toJpeg } = await import('html-to-image');
      const currentOrigin = window.location.origin;
      const dataUrl = await toJpeg(document.body, {
        quality: 0.8,
        pixelRatio: 1,
        cacheBust: true,
        skipFonts: true,
        filter: (node: HTMLElement) => {
          if (node.classList?.contains('bug-report-widget')) return false;
          if (node.tagName === 'NOSCRIPT' || node.tagName === 'IFRAME') return false;
          // Skip cross-origin images to prevent canvas tainting
          if (node.tagName === 'IMG') {
            const src = (node as HTMLImageElement).src;
            if (src && !src.startsWith(currentOrigin) && !src.startsWith('data:') && !src.startsWith('blob:')) {
              return false;
            }
          }
          return true;
        },
      });
      // Convert data URL to Blob directly (fetch on data URLs is blocked by CSP)
      const parts = dataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(parts[1]);
      const arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
      return new Blob([arr], { type: mime });
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : err instanceof Event
          ? `DOM event error (type: ${err.type || 'unknown'})`
          : String(err);
      console.error('[BugReportWidget] Screenshot capture failed:', msg);
      return null;
    }
  }, []);

  const handleOpen = async () => {
    const blob = await captureScreenshot();
    if (blob) {
      setScreenshot(blob);
      setScreenshotPreview(URL.createObjectURL(blob));
    }

    const consoleBlob = await renderConsoleImage(getConsoleErrors()).catch(() => null);
    if (consoleBlob) {
      setConsoleScreenshot(consoleBlob);
      setConsoleScreenshotPreview(URL.createObjectURL(consoleBlob));
    }

    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTitle('');
    setDescription('');
    setSteps('');
    setCanReplicate(false);
    setScreenshot(null);
    setScreenshotPreview(null);
    setConsoleScreenshot(null);
    setConsoleScreenshotPreview(null);
    setAttachments([]);
    setAttachmentPreviews([]);
    setError(null);
    setSubmitted(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setScreenshot(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const handleAttachmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - attachments.length;
    const toAdd = files.slice(0, remaining).filter(f => f.size <= 10 * 1024 * 1024);
    if (toAdd.length > 0) {
      setAttachments(prev => [...prev, ...toAdd]);
      setAttachmentPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setAttachmentPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('appSource', appSource);
      formData.append('pageUrl', window.location.href);
      formData.append('browserInfo', JSON.stringify({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      }));
      formData.append('consoleErrors', JSON.stringify(getConsoleErrors()));

      if (steps.trim()) formData.append('stepsToReproduce', steps.trim());
      formData.append('canReplicate', String(canReplicate));
      if (screenshot) formData.append('screenshot', screenshot, 'screenshot.jpg');
      if (consoleScreenshot) formData.append('consoleScreenshot', consoleScreenshot, 'console.png');
      for (const file of attachments) {
        formData.append('attachments', file, file.name);
      }

      const res = await fetch(API_URL, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Submission failed' }));
        throw new Error(data.error || 'Submission failed');
      }

      setSubmitted(true);
      setTimeout(handleClose, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={handleOpen}
        className="bug-report-widget fixed bottom-6 right-6 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-[#454D9A] text-white shadow-lg hover:bg-[#3a4285] transition-all hover:scale-105 group"
        title="Report a Bug"
      >
        <Bug className="h-3 w-3" />
        <span className="absolute bottom-full right-0 mb-2 hidden rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white whitespace-nowrap group-hover:block">
          Report a Bug
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-700">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
              <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-[#454D9A]" />
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Report a Bug</h2>
              </div>
              <button onClick={handleClose} className="rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>

            {/* Success State */}
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Bug reported!</p>
                <p className="text-sm text-zinc-500 mt-1">Thank you for helping us improve.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                {/* Screenshot Previews */}
                {(screenshotPreview || consoleScreenshotPreview) && (
                  <div className="space-y-2">
                    {screenshotPreview && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5" /> Page Screenshot
                        </label>
                        <div className="relative group">
                          <img
                            src={screenshotPreview}
                            alt="Page screenshot"
                            className="w-full h-32 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                          />
                          <button
                            type="button"
                            onClick={() => { setScreenshot(null); setScreenshotPreview(null); }}
                            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    {consoleScreenshotPreview && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Terminal className="h-3.5 w-3.5" /> Console Log
                        </label>
                        <div className="relative group">
                          <img
                            src={consoleScreenshotPreview}
                            alt="Console log"
                            className="w-full h-32 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                          />
                          <button
                            type="button"
                            onClick={() => { setConsoleScreenshot(null); setConsoleScreenshotPreview(null); }}
                            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Replace/Upload Screenshot */}
                {!screenshotPreview && (
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 px-4 py-3 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors w-full"
                    >
                      <Camera className="h-4 w-4" />
                      Attach screenshot
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

                {/* Attach Files */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => attachmentsInputRef.current?.click()}
                    disabled={attachments.length >= 5}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors w-full disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Paperclip className="h-4 w-4" />
                    Attach files ({attachments.length}/5)
                  </button>
                  <input
                    ref={attachmentsInputRef}
                    type="file"
                    accept="image/*,.pdf,.mp4,.webm"
                    multiple
                    onChange={handleAttachmentsChange}
                    className="hidden"
                  />
                  {attachmentPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachmentPreviews.map((preview, i) => (
                        <div key={i} className="relative group">
                          {attachments[i]?.type.startsWith('image/') ? (
                            <img
                              src={preview}
                              alt={`Attachment ${i + 1}`}
                              className="h-16 w-16 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700"
                            />
                          ) : (
                            <div className="h-16 w-16 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                              <span className="text-[10px] font-medium text-zinc-500 uppercase">
                                {attachments[i]?.name.split('.').pop()}
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            className="absolute -top-1.5 -right-1.5 rounded-full bg-black/70 p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <label htmlFor="bug-title" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="bug-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief description of the issue"
                    required
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#454D9A]"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label htmlFor="bug-description" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="bug-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What happened? What did you expect?"
                    required
                    rows={3}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#454D9A] resize-none"
                  />
                </div>

                {/* Steps to Reproduce */}
                <div className="space-y-1">
                  <label htmlFor="bug-steps" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Steps to Reproduce <span className="text-zinc-400">(optional)</span>
                  </label>
                  <textarea
                    id="bug-steps"
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                    rows={3}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#454D9A] resize-none"
                  />
                </div>

                {/* Can Replicate */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canReplicate}
                    onChange={(e) => setCanReplicate(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#454D9A] focus:ring-[#454D9A]"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">I can replicate this issue</span>
                </label>

                {/* Error Message */}
                {error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !title.trim() || !description.trim()}
                    className="flex items-center gap-2 rounded-lg bg-[#454D9A] px-4 py-2 text-sm font-medium text-white hover:bg-[#3a4285] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Bug Report'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
