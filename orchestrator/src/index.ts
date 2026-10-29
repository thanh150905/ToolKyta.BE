import { config, validateModelsConfig, ALLOW_REAL_PUSH } from './config.js';
import { startServer } from './server.js';

export function checkNodeVersion(version = process.versions.node): void {
  const parts = version.split('.').map(Number);
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  if (major < 22 || (major === 22 && minor < 5)) {
    console.error(`\n❌ LỖI RUNTIME: Kyta Swarm yêu cầu Node.js >= 22.5.0 (để hỗ trợ built-in node:sqlite).`);
    console.error(`Phiên bản Node hiện tại là: v${version}`);
    console.error(`👉 Hướng dẫn khắc phục:`);
    console.error(`   - Nếu dùng nvm: nvm install 22 && nvm use 22`);
    console.error(`   - Nếu dùng fnm: fnm install 22 && fnm use 22`);
    console.error(`   - Hoặc tải bản Node 22 LTS mới nhất tại https://nodejs.org\n`);
    process.exit(1);
  }
}

// Kiểm tra phiên bản Node lúc khởi động
checkNodeVersion();

// Kiểm tra hợp lệ cấu hình model và giá lúc khởi động
validateModelsConfig();

// Lưới an toàn cuối: lỗi lọt ra ngoài chỉ ghi log, không đánh sập cả đội đang chạy.
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

startServer();

console.log('Đội:', config.agents.map((a) => `${a.id}(${a.model})`).join(', '));
console.log('LLM:', config.llm.baseURL);
console.log('Kill switch ALLOW_REAL_PUSH:', ALLOW_REAL_PUSH ? '1 (cho phép push qua duyệt)' : '0 (chặn ghi thật)');
console.log('Duyệt kế hoạch:', config.swarm.requirePlanApproval ? 'bật' : 'tắt', '· replan tối đa:', config.swarm.maxReplans);

