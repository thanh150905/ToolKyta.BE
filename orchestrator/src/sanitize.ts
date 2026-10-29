// @ts-check
/**
 * Tiện ích che giấu dữ liệu nhạy cảm (token, password, secrets, PII)
 * trước khi gửi vào LLM context, lưu SQLite hoặc hiển thị qua browser_network.
 */

const TOKEN_PATTERN = /\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi;
const JWT_PATTERN = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g;
const SECRET_KV_PATTERN = /(["']?(?:api[_-]?key|access_token|refresh_token|id_token|client_secret|password|passwd|auth_token|token|secret)["']?\s*[:=]\s*["']?)([^"',\s}{]{6,})(["']?)/gi;
const AUTH_HEADER_PATTERN = /((?:authorization|x-api-key|proxy-authorization|cookie|set-cookie)\s*:\s*)([^\r\n]+)/gi;
const URL_CREDENTIAL_PATTERN = /(https?:\/\/)([^:\s\/]+):([^@\s\/]+)@/g;
const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const PHONE_PATTERN = /\b(?:\+84|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9\d)\d{7}\b/g;
const CCCD_PATTERN = /\b\d{12}\b/g;

export function sanitize(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(URL_CREDENTIAL_PATTERN, '$1$2:[REDACTED]@')
    .replace(TOKEN_PATTERN, '$1[REDACTED_TOKEN]')
    .replace(JWT_PATTERN, '[REDACTED_JWT]')
    .replace(AUTH_HEADER_PATTERN, '$1[REDACTED]')
    .replace(SECRET_KV_PATTERN, (_match, prefix, _val, suffix) => `${prefix}[REDACTED]${suffix}`)
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]')
    .replace(CCCD_PATTERN, '[REDACTED_ID]');
}

export function sanitizeObject<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return typeof obj === 'string' ? (sanitize(obj) as unknown as T) : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (/password|token|secret|key|auth/i.test(k) && typeof v === 'string') {
      copy[k] = '[REDACTED]';
    } else {
      copy[k] = sanitizeObject(v);
    }
  }
  return copy as T;
}
