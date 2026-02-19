interface ConsoleEntry {
  level: 'error' | 'warn';
  message: string;
  timestamp: string;
  stack?: string;
}

const BG_COLOR = '#1e1e2e';
const HEADER_BG = '#181825';
const ERROR_COLOR = '#f38ba8';
const WARN_COLOR = '#fab387';
const TEXT_COLOR = '#cdd6f4';
const DIM_COLOR = '#6c7086';
const FONT = '13px "Cascadia Code", "Fira Code", "Consolas", monospace';
const LINE_HEIGHT = 20;
const PADDING = 16;
const MAX_MSG_CHARS = 120;
const MAX_STACK_LINES = 3;
const CANVAS_WIDTH = 720;

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export async function renderConsoleImage(entries: ConsoleEntry[]): Promise<Blob | null> {
  if (!entries.length) return null;

  // Calculate canvas height
  let totalLines = 0;
  for (const entry of entries) {
    totalLines += 1; // main line
    if (entry.stack) {
      const stackLines = entry.stack.split('\n').slice(1, MAX_STACK_LINES + 1);
      totalLines += stackLines.length;
    }
  }

  const headerHeight = 36;
  const contentHeight = totalLines * LINE_HEIGHT + PADDING * 2;
  const canvasHeight = Math.min(headerHeight + contentHeight, 600);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  // Header
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(0, 0, CANVAS_WIDTH, headerHeight);
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = TEXT_COLOR;
  const errorCount = entries.filter(e => e.level === 'error').length;
  const warnCount = entries.filter(e => e.level === 'warn').length;
  const parts: string[] = [];
  if (errorCount) parts.push(`${errorCount} error${errorCount > 1 ? 's' : ''}`);
  if (warnCount) parts.push(`${warnCount} warning${warnCount > 1 ? 's' : ''}`);
  ctx.fillText(`Console Output \u2014 ${parts.join(', ')}`, PADDING, 24);

  // Entries
  ctx.font = FONT;
  let y = headerHeight + PADDING + LINE_HEIGHT;

  for (const entry of entries) {
    if (y > canvasHeight - 10) break;

    const time = formatTime(entry.timestamp);
    const levelTag = entry.level === 'error' ? 'ERR' : 'WRN';
    const levelColor = entry.level === 'error' ? ERROR_COLOR : WARN_COLOR;

    // Timestamp
    ctx.fillStyle = DIM_COLOR;
    ctx.fillText(time, PADDING, y);

    // Level tag
    ctx.fillStyle = levelColor;
    ctx.fillText(levelTag, PADDING + 80, y);

    // Message
    ctx.fillStyle = levelColor;
    ctx.fillText(truncate(entry.message, MAX_MSG_CHARS), PADDING + 120, y);
    y += LINE_HEIGHT;

    // Stack trace (dimmed, indented)
    if (entry.stack) {
      ctx.fillStyle = DIM_COLOR;
      const stackLines = entry.stack.split('\n').slice(1, MAX_STACK_LINES + 1);
      for (const line of stackLines) {
        if (y > canvasHeight - 10) break;
        ctx.fillText('  ' + truncate(line.trim(), MAX_MSG_CHARS - 4), PADDING + 120, y);
        y += LINE_HEIGHT;
      }
    }
  }

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
