import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

/** Markdown do LLM sinh → HTML đã lọc (không cho script/handler lọt vào dashboard). */
export function md(src: string): string {
  return DOMPurify.sanitize(marked.parse(src ?? '', { async: false }) as string);
}

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const fmtSize = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
