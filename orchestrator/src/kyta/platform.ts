import path from 'node:path';
import { createRequire } from 'node:module';
import { REPO } from '../config.js';

// Dùng lại đúng phiên đăng nhập + HTTP client của kyta (in-process) để Recon dò API — CHỈ GET.
const req = createRequire(path.join(REPO, 'src', 'cli.js'));
const session = req('./core/session') as {
  open: (customer: string, env: string, service?: string) => Promise<unknown>;
};
const http = req('./core/http') as {
  request: (sess: unknown, method: string, pathname: string) => Promise<unknown>;
};

export const SERVICES = ['eform', 'eflow', 'ewriter', 'ecatalog', 'eworkspace'] as const;

export async function platformGet(customer: string, env: string, service: string, pathname: string): Promise<unknown> {
  if (!(SERVICES as readonly string[]).includes(service)) throw new Error(`service không hợp lệ: ${service}`);
  if (!pathname.startsWith('/')) throw new Error('path phải bắt đầu bằng "/"');
  const sess = await session.open(customer, env, service);
  return http.request(sess, 'GET', pathname);
}
