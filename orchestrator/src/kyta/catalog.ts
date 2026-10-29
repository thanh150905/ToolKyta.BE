import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { REPO } from '../config.js';

/**
 * "Bản đồ dự án" nạp vào prompt: danh mục lệnh kyta (đọc thẳng từ code nên luôn đúng),
 * mục lục docs/, và các customer/env đang có trong workspace/. Ngắn gọn để tiết kiệm token.
 */
const req = createRequire(path.join(REPO, 'src', 'cli.js'));
const MODULES = ['eform', 'eflow', 'email', 'ewriter', 'ecatalog', 'eworkspace'];

export type Impact = 'server_read' | 'server_write' | 'local_read' | 'local_write' | 'high_risk';

export interface CommandTarget {
  customer?: string;
  env?: string;
  isProd?: boolean;
  resource?: string;
  localWritePaths?: string[];
  hasForce?: boolean;
  hasYes?: boolean;
  isDryRun?: boolean;
}

export interface CommandInspection {
  valid: boolean;
  module?: string;
  command?: string;
  subcommand?: string;
  impacts: Impact[];
  target?: CommandTarget;
  error?: string;
}

const commandsMeta = req('./core/commands-meta') as {
  inspectCommand: (args: string[]) => CommandInspection;
};

export const inspectCommand = commandsMeta.inspectCommand;

type Mod = { title: string; commands: Record<string, [string, () => { usage: string }]> };

/** Cú pháp THẬT của mọi lệnh (đọc từ `usage` trong code) — agent/Overseer không được tự chế cờ. */
export function commandCatalog(): string {
  const lines: string[] = [];
  for (const m of MODULES) {
    const mod = req(`./${m}`) as Mod;
    lines.push(`#### ${m} — ${mod.title}`);
    for (const [, [desc, load]] of Object.entries(mod.commands)) {
      lines.push(`- ${desc}:\n${String(load().usage).split('\n').map((l) => `    ${l}`).join('\n')}`);
    }
  }
  return lines.join('\n');
}

export function docsIndex(): string {
  const dir = path.join(REPO, 'docs');
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const head = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').find((l) => l.startsWith('#')) ?? '';
      return `- docs/${f}: ${head.replace(/^#+\s*/, '').slice(0, 100)}`;
    })
    .join('\n');
}

export function workspaceIndex(): string {
  const ws = path.join(REPO, 'workspace');
  const out: string[] = [];
  for (const cust of fs.readdirSync(ws)) {
    const cdir = path.join(ws, cust);
    if (!fs.statSync(cdir).isDirectory()) continue;
    for (const env of fs.readdirSync(cdir)) {
      const edir = path.join(cdir, env);
      if (!fs.statSync(edir).isDirectory()) continue;
      const kinds = fs.readdirSync(edir).filter((k) => fs.statSync(path.join(edir, k)).isDirectory());
      out.push(`- workspace/${cust}/${env}/{${kinds.join(',')}}`);
    }
  }
  return out.join('\n');
}

let cache = '';
export function projectMap(): string {
  if (!cache) {
    cache = [
      '## Dự án: kyta-cli — tự động hoá Kyta Platform (low-code FPT IS) theo khách hàng × môi trường.',
      'Lệnh: kyta <phân hệ> <lệnh> [tham số] — tham số là VỊ TRÍ như cú pháp dưới (KHÔNG có cờ --customer/--env/--form).',
      'Lệnh làm việc trên 1 form nhận <form-folder> = đường dẫn thư mục STAGE trong workspace (có .meta.json) — tìm bằng tool find_local.',
      '### Cú pháp lệnh (nguồn sự thật)', commandCatalog(),
      '### Tài liệu (nguồn sự thật về API/schema — đọc trước khi sửa)', docsIndex(),
      '### Dữ liệu cục bộ (workspace)', workspaceIndex(),
      '### Mã nguồn', '- src/<phân hệ>/{api.js,index.js,commands/*.js}; src/core/* dùng chung; test/*.test.js (node --test).',
    ].join('\n');
  }
  return cache;
}
