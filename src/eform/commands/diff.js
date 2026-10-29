// @ts-check
'use strict';
// So code động + custom UI giữa local và server: dựng 2 cây tạm rồi in bằng `git diff --no-index`.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const api = require('../api');
const tree = require('../tree');
const inspect = require('../inspect');
const formDef = require('../formDef');
const fields = require('../fields');
const { writeText, safeName } = require('../../core/fsx');
const { parseArgs, usage } = require('../../core/args');

const USAGE = 'kyta eform diff <form-folder> [--code | --ui | --fields]';

async function run(/** @type {string[]} */ argv) {
  const { _, flags } = parseArgs(argv);
  if (!_[0]) usage(USAGE);
  const dir = path.resolve(_[0]);
  const st = inspect.formState(dir);
  const id = st.identityId || st.formId;   // so với form CỦA thư mục này
  if (!id) throw new Error('Không xác định được formId (code/ rỗng và .meta.json không có formId).');
  // Bộ chọn: nêu cờ nào thì chỉ so cái đó; không nêu → so cả ba.
  const sel = ['--code', '--ui', '--fields'].filter(f => flags.has(f));
  const want = (/** @type {string} */ t) => sel.length ? sel.includes('--' + t) : true;
  const withCode = want('code'), withUi = want('ui'), withFields = want('fields');

  const sess = await api.open(st.customer, st.env);
  console.log(`Diff ${id}  (${st.customer}/${st.env})  server ↔ local\n`);
  if (st.formId !== id) console.log(`  ⚠ đích push là ${st.formId}, khác form của thư mục (${id}) — nên khai targetFormId.\n`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kyta-diff-'));
  const server = path.join(tmp, 'server'), local = path.join(tmp, 'local');
  try {
    if (withCode) {
      for (const [key, v] of Object.entries(await api.getCode(sess, id))) writeText(path.join(server, 'code', safeName(key) + '.js'), v.code);
      for (const [f, text] of Object.entries(tree.readCode(dir))) writeText(path.join(local, 'code', f), text);
    }
    // ui + fields cùng cần jsonForm → lấy form 1 lần.
    const needForm = (withUi && tree.uiFolders(dir).length) || (withFields && fields.readDoc(dir));
    const form = needForm ? await api.getForm(sess, id) : null;
    const parsed = form ? formDef.parseFormDef(form) : { def: null };
    if (withUi && tree.uiFolders(dir).length && parsed.def) {
      const find = formDef.fieldLocator(formDef.collectCustomFields(parsed.def), tree.readMeta(dir));
      for (const folder of tree.uiFolders(dir)) {
        const cur = find(folder)?.node.customRenderCode || {};
        for (const [file, key] of Object.entries(formDef.UI_PARTS)) {
          const lp = path.join(tree.uiDir(dir), folder, file);
          if (fs.existsSync(lp)) writeText(path.join(local, 'ui', folder, file), fs.readFileSync(lp, 'utf8'));
          writeText(path.join(server, 'ui', folder, file), cur[key] == null ? '' : String(cur[key]));
        }
      }
    }
    if (withFields && parsed.def) {
      const doc = fields.readDoc(dir);
      const find = formDef.fieldFinder(formDef.collectAllFields(parsed.def));
      for (const f of doc?.fields || []) {
        const srv = find({ hashid: f.hashid, key: f.key });
        const name = safeName(f.key || f.hashid || 'field') + '.json';
        writeText(path.join(local, 'fields', name), JSON.stringify(f.config, null, 2) + '\n');
        writeText(path.join(server, 'fields', name), srv ? JSON.stringify(fields.toConfig(srv.node), null, 2) + '\n' : '(field không còn trên server)\n');
      }
    }
    fs.mkdirSync(server, { recursive: true }); fs.mkdirSync(local, { recursive: true });
    // git diff --no-index: 0 = giống nhau, 1 = có khác biệt (bình thường), >1 = lỗi.
    const r = spawnSync('git', ['--no-pager', 'diff', '--no-index', '--', server, local], { stdio: 'inherit' });
    if (r.status === 0) console.log('✓ Không có khác biệt — local khớp server.');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { run, usage: USAGE };
