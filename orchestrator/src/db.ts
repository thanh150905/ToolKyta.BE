import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

// Lưu vết lâu dài: run, task, tin nhắn, sự kiện, usage, inbox — mở lại dashboard vẫn còn lịch sử.
fs.mkdirSync(config.dataDir, { recursive: true });
export const db = new DatabaseSync(path.join(config.dataDir, 'swarm.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, prompt TEXT, title TEXT, intent TEXT, status TEXT,
    summary TEXT, digest TEXT, replans INTEGER DEFAULT 0, created_at INTEGER, finished_at INTEGER);
  CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, run_id TEXT, agent TEXT, title TEXT, instructions TEXT,
    deps TEXT, status TEXT, result TEXT, created_at INTEGER, started_at INTEGER, finished_at INTEGER);
  CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, run_id TEXT, task_id TEXT,
    role TEXT, content TEXT, meta TEXT, ts INTEGER);
  CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, agent TEXT, text TEXT, ts INTEGER);
  CREATE TABLE IF NOT EXISTS usage (id INTEGER PRIMARY KEY AUTOINCREMENT, agent TEXT, model TEXT, prompt INTEGER,
    completion INTEGER, cost REAL, ts INTEGER);
  CREATE TABLE IF NOT EXISTS inbox (id TEXT PRIMARY KEY, kind TEXT, agent TEXT, run_id TEXT, task_id TEXT, title TEXT,
    body TEXT, status TEXT, answer TEXT, ts INTEGER);
  CREATE INDEX IF NOT EXISTS ix_msg_agent ON messages(agent, id);
  CREATE INDEX IF NOT EXISTS ix_task_run ON tasks(run_id);
`);

// Cột bổ sung cho DB tạo từ bản cũ (ALTER lỗi nếu đã có → bỏ qua).
try { db.exec('ALTER TABLE usage ADD COLUMN run_id TEXT'); } catch { /* đã có */ }
try { db.exec('ALTER TABLE tasks ADD COLUMN verification TEXT'); } catch { /* đã có */ }

// Tiến trình trước bị tắt giữa chừng → đánh dấu dở dang để không treo trạng thái "đang chạy".
db.exec(`UPDATE tasks SET status='interrupted' WHERE status IN ('queued','working','blocked');
         UPDATE runs SET status='interrupted' WHERE status IN ('planning','awaiting_plan','running');
         UPDATE inbox SET status='expired' WHERE status='pending';`);

export const J = (v: unknown) => JSON.stringify(v ?? null);
export const P = <T>(s: unknown, d: T): T => { try { return s ? (JSON.parse(String(s)) as T) : d; } catch { return d; } };
