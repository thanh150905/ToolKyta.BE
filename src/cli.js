// @ts-check
'use strict';
// Điểm vào CLI:  kyta <phân hệ> <lệnh> [tham số]   |   kyta <lệnh chung> [tham số]
const { UsageError } = require('./core/args');

/** @typedef {{ run: (argv: string[]) => any, usage: string }} Command */
/** @typedef {{ title: string, commands: Record<string, [string, () => Command]> }} Module */

/** @type {Record<string, () => Module>} */
const MODULES = {
  eform: () => require('./eform'),
  eflow: () => require('./eflow'),
  email: () => require('./email'),
  ewriter: () => require('./ewriter'),
  ecatalog: () => require('./ecatalog'),
  eworkspace: () => require('./eworkspace'),
};

/** @type {Record<string, [string, () => Command]>} */
const GLOBAL = {
  login: ['Đăng nhập + cache token cho customer@env', () => require('./commands/login')],
  log: ['Lịch sử thao tác (mọi phân hệ)', () => require('./commands/log')],
  har: ['Liệt kê request GHI trong file HAR của 1 thao tác UI', () => require('./commands/har')],
  where: ['Tra đồ thị workspace: form/field/catalog/luồng được dùng ở đâu', () => require('./commands/where')],
};

function help() {
  console.log('kyta <phân hệ> <lệnh> [tham số]    (kyta <phân hệ> để xem cú pháp từng lệnh)\n');
  for (const [name, load] of Object.entries(MODULES)) {
    const mod = load();
    console.log(`${name} — ${mod.title}`);
    for (const [cmd, [desc]] of Object.entries(mod.commands)) console.log(`  ${cmd.padEnd(10)}${desc}`);
    console.log('');
  }
  console.log('Chung');
  for (const [cmd, [desc]] of Object.entries(GLOBAL)) console.log(`  ${cmd.padEnd(10)}${desc}`);
}

/** Cú pháp đầy đủ của mọi lệnh trong 1 phân hệ. */
function moduleHelp(/** @type {string} */ name, /** @type {Module} */ mod) {
  console.log(`${name} — ${mod.title}\n`);
  for (const [, [desc, load]] of Object.entries(mod.commands)) console.log(`# ${desc}\n${load().usage}\n`);
}

async function main(/** @type {string[]} */ argv) {
  const [first, second, ...rest] = argv;
  try {
    if (!first || ['help', '-h', '--help'].includes(first)) return help();
    if (GLOBAL[first]) return await GLOBAL[first][1]().run(argv.slice(1));
    if (!MODULES[first]) { console.error(`Không có phân hệ/lệnh "${first}".\n`); help(); process.exitCode = 2; return; }
    const mod = MODULES[first]();
    if (!second || !mod.commands[second]) {
      if (second) console.error(`Không có lệnh "${first} ${second}".\n`);
      moduleHelp(first, mod);
      process.exitCode = second ? 2 : 0;
      return;
    }
    await mod.commands[second][1]().run(rest);
  } catch (e) {
    if (e instanceof UsageError) { console.error('Dùng:\n' + e.message); process.exitCode = 2; }
    else { console.error('✗ ' + (e?.message || e)); process.exitCode = 1; }
  }
}

module.exports = { main };
