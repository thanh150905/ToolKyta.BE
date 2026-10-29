import path from 'node:path';

export interface LockEntry {
  runId: string;
  taskId: string;
  agent: string;
  acquiredAt: number;
}

// Map lưu trữ normalized relative path -> thông tin lock
const fileLocks = new Map<string, LockEntry>();

function normalize(p: string): string {
  return path.normalize(p).split(path.sep).join('/');
}

/**
 * Khoá đường dẫn tương đối để tránh các run / task đồng thời sửa cùng file.
 * Nếu file đang bị khoá bởi task khác, throw Error để ngăn chặn xung đột.
 */
export function acquirePathLock(relPath: string, taskId: string, runId: string, agent: string): void {
  const normPath = normalize(relPath);
  const existing = fileLocks.get(normPath);
  if (existing) {
    if (existing.taskId === taskId) {
      return; // Cùng 1 task khoá lại file đó (re-entrant)
    }
    throw new Error(
      `File "${normPath}" đang bị khoá bởi task khác (${existing.taskId}, agent ${existing.agent}, run ${existing.runId}). Vui lòng chờ task đó hoàn thành.`
    );
  }
  fileLocks.set(normPath, { runId, taskId, agent, acquiredAt: Date.now() });
}

/**
 * Giải phóng toàn bộ khoá file mà 1 task đang giữ.
 */
export function releaseLocksForTask(taskId: string): string[] {
  const released: string[] = [];
  for (const [p, entry] of fileLocks.entries()) {
    if (entry.taskId === taskId) {
      fileLocks.delete(p);
      released.push(p);
    }
  }
  return released;
}

/**
 * Giải phóng toàn bộ khoá file thuộc về 1 run.
 */
export function releaseLocksForRun(runId: string): string[] {
  const released: string[] = [];
  for (const [p, entry] of fileLocks.entries()) {
    if (entry.runId === runId) {
      fileLocks.delete(p);
      released.push(p);
    }
  }
  return released;
}

/**
 * Kiểm tra xem đường dẫn có đang bị khoá hay không.
 */
export function isPathLocked(relPath: string): boolean {
  return fileLocks.has(normalize(relPath));
}

/**
 * Lấy thông tin lock hiện tại của một đường dẫn.
 */
export function getPathLock(relPath: string): LockEntry | undefined {
  return fileLocks.get(normalize(relPath));
}

/**
 * Xoá toàn bộ lock (dùng khi dọn dẹp hoặc test).
 */
export function clearAllLocks(): void {
  fileLocks.clear();
}
