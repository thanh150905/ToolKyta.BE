import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import express, { type Request, type Response } from 'express';
import { Server } from 'socket.io';
import { config, ROOT } from './config.js';
import { bus } from './bus.js';
import { swarm } from './swarm/swarm.js';
import { inbox } from './swarm/inbox.js';
import { listMessages, recentEvents } from './swarm/store.js';
import { openBrowser } from './tools/browser.js';

export function startServer(): void {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const wrap = (fn: (req: Request, res: Response) => unknown) => async (req: Request, res: Response) => {
    try { res.json((await fn(req, res)) ?? { ok: true }); }
    catch (e) { res.status(400).json({ error: (e as Error).message }); }
  };
  const text = (req: Request) => {
    const t = String(req.body?.text ?? '').trim();
    if (!t) throw new Error('Thiếu nội dung.');
    return t;
  };

  app.get('/api/state', wrap(() => swarm.snapshot()));
  app.get('/api/messages/:agent', wrap((req) => listMessages(String(req.params.agent), Number(req.query.limit) || 300)));
  app.get('/api/events', wrap(() => recentEvents(300)));
  app.post('/api/prompt', wrap(async (req) => ({ run: await swarm.submit(text(req)) })));
  app.post('/api/agents/:id/message', wrap(async (req) => ({ run: await swarm.direct(String(req.params.id), text(req)) })));
  app.post('/api/agents/:id/:action(pause|resume|stop)', wrap((req) => {
    const id = String(req.params.id);
    const ag = swarm.agents.get(id);
    if (!ag) throw new Error('Không có agent');
    if (req.params.action === 'stop') swarm.stopAgent(id);
    else if (req.params.action === 'pause') ag.pause();
    else ag.resume();
  }));
  app.post('/api/agents/:id/model', wrap((req) => swarm.setModel(String(req.params.id), String(req.body?.model))));
  app.post('/api/team/:action(pause|resume)', wrap((req) => (req.params.action === 'pause' ? swarm.pauseTeam() : swarm.resumeTeam())));
  app.post('/api/runs/:id/cancel', wrap((req) => swarm.cancelRun(String(req.params.id))));
  app.post('/api/runs/:id/resume', wrap(async (req) => ({ run: await swarm.resumeRun(String(req.params.id)) })));
  app.post('/api/inbox/:id', wrap((req) => {
    const ok = inbox.resolve(String(req.params.id), { approved: !!req.body?.approved, answer: String(req.body?.answer ?? '') });
    if (!ok) throw new Error('Mục này không còn chờ (có thể đã hết hạn sau khi khởi động lại).');
  }));
  app.post('/api/browser/open', wrap(async (req) => { await openBrowser(req.body?.url ? String(req.body.url) : undefined); }));

  // Bản build của dashboard (npm run build trong dashboard/) — phục vụ luôn ở cổng backend.
  const dist = path.join(ROOT, 'dashboard', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  const http = createServer(app);
  // Chỉ trang chạy trên máy này được nghe sự kiện (tránh web lạ đọc log/diff qua WebSocket).
  const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  const io = new Server(http, { cors: { origin: (o, cb) => cb(null, !o || LOCAL.test(o)) } });
  bus.on('evt', (e) => io.emit('evt', e));

  // Chỉ nghe localhost: API này chạy được lệnh kyta bằng tài khoản của bạn — không mở ra mạng LAN.
  http.listen(config.port, '127.0.0.1', () => {
    console.log(`Kyta Swarm backend: http://localhost:${config.port}${fs.existsSync(dist) ? '  (dashboard build)' : ''}`);
  });
}
