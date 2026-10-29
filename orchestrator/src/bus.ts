import { EventEmitter } from 'node:events';
import { db } from './db.js';

/**
 * Kênh sự kiện duy nhất của swarm. Server đẩy nguyên xi mọi sự kiện qua WebSocket ('evt').
 * Sự kiện có `log` sẽ được ghi vào bảng events (Event log ở chân dashboard).
 */
export interface Evt { type: string; [k: string]: unknown }

class Bus extends EventEmitter {
  emitEvt(e: Evt, log?: { agent?: string; text: string }): void {
    const ts = Date.now();
    if (log) {
      db.prepare('INSERT INTO events(type, agent, text, ts) VALUES (?,?,?,?)').run(e.type, log.agent ?? null, log.text, ts);
      this.emit('evt', { type: 'event', event: { type: e.type, agent: log.agent ?? null, text: log.text, ts } });
    }
    this.emit('evt', { ...e, ts });
  }
}

export const bus = new Bus();
bus.setMaxListeners(50);
