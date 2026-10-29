// @ts-check
'use strict';
// Thao tác file bản in (.docx) cục bộ — đích là THƯ MỤC tài liệu đã pull (sửa document.xml) hoặc 1 file .docx.
//   info            : liệt kê placeholder / IF / bookmark
//   check | fix     : đối chiếu placeholder "Nhãn (hashid)" với field form; fix sửa nhãn/hashid lệch
//   rename          : đổi tên 1 placeholder
//   field | table   : chèn MERGEFIELD sau chữ neo | bảng in (DOCVARIABLE + col_N) sau đoạn chứa neo
//   strip-comments  : gỡ toàn bộ comment
// Thư mục tài liệu: sửa xong chạy `kyta ewriter push <thư mục>` để upload.
const fs = require('fs');
const path = require('path');
const docx = require('../docx');
const store = require('../store');
const paths = require('../../core/paths');
const { loadForms } = require('../forms');
const { readJson, writeText, isDir } = require('../../core/fsx');
const { parseArgs, usage } = require('../../core/args');

const USAGE = [
  'kyta ewriter docx info   <đích>',
  'kyta ewriter docx check  <đích> [--form <formId|tên>[,..]] [--all]',
  'kyta ewriter docx fix    <đích> [--form ..] [--dry-run]',
  'kyta ewriter docx rename <đích> --from "Nhãn cũ (hashid)" --to "Nhãn mới (hashid)"',
  'kyta ewriter docx field  <đích> --after "chữ neo" (--var "Nhãn (hashid)" | --field <nhãn|hashid> [--form ..])',
  'kyta ewriter docx table  <đích> --after "chữ neo" --field <nhãn|hashid bảng> [--form ..] [--widths 420,900,..] [--size 20]',
  'kyta ewriter docx strip-comments <đích>',
  '    <đích> = thư mục tài liệu đã pull (workspace/<c>/<env>/ewriter/<tên>) | file .docx',
  '    --form mặc định = eformId của tài liệu; file .docx ngoài workspace cần thêm --in <customer>/<env>',
].join('\n');

const DOC_PART = 'word/document.xml';

/**
 * Mở đích sửa. Thư mục: xml = document.xml (gộp dòng); entries = template.docx (giữ nguyên document.xml gốc
 * trong template — làm mốc phát hiện xung đột khi push). File: sửa thẳng file (lưu .bak lần đầu).
 */
function openTarget(/** @type {string} */ target) {
  const abs = path.resolve(target);
  if (isDir(abs)) {
    if (!store.hasDocx(abs)) throw new Error(`Thư mục chưa có ${store.DOCX}/${store.XML} — chạy lại kyta ewriter pull (không --no-docx).`);
    const meta = readJson(path.join(abs, store.META), {});
    const loc = paths.parseWorkspacePath(abs);
    return {
      label: paths.toRepoRel(abs), meta, loc,
      entries: docx.readZip(fs.readFileSync(path.join(abs, store.DOCX))),
      xml: docx.compact(fs.readFileSync(path.join(abs, store.XML), 'utf8')),
      save(/** @type {string} */ xml, /** @type {docx.ZipEntry[]|null} */ entries = null) {
        writeText(path.join(abs, store.XML), docx.pretty(xml));
        if (entries) {
          const orig = this.entries.find(e => e.name === DOC_PART);
          fs.writeFileSync(path.join(abs, store.DOCX), docx.writeZip(orig ? docx.setEntry(entries, DOC_PART, orig.data) : entries));
        }
      },
    };
  }
  if (!/\.docx$/i.test(abs) || !fs.existsSync(abs)) throw new Error(`Không thấy thư mục tài liệu hoặc file .docx: ${target}`);
  const entries = docx.readZip(fs.readFileSync(abs));
  const part = entries.find(e => e.name === DOC_PART);
  if (!part) throw new Error('không thấy word/document.xml trong file');
  return {
    label: target, meta: /** @type {any} */ ({}), loc: paths.parseWorkspacePath(abs),
    entries, xml: part.data.toString('utf8'),
    save(/** @type {string} */ xml, /** @type {docx.ZipEntry[]|null} */ list = null) {
      if (!fs.existsSync(abs + '.bak')) fs.copyFileSync(abs, abs + '.bak');
      fs.writeFileSync(abs, docx.writeZip(docx.setEntry(list || entries, DOC_PART, Buffer.from(xml, 'utf8'))));
    },
  };
}

/** customer/env của đích: theo đường dẫn workspace, hoặc --in c/env. */
function whereOf(/** @type {ReturnType<typeof openTarget>} */ t, /** @type {Record<string, string>} */ opts) {
  const [c, e] = String(opts['--in'] || '').split('/');
  if (c && e) return { customer: c, env: e };
  if (t.loc?.customer && t.loc?.env) return { customer: t.loc.customer, env: t.loc.env };
  throw new Error('Không suy ra được customer/env — thêm --in <customer>/<env>.');
}

async function formsFor(/** @type {ReturnType<typeof openTarget>} */ t, /** @type {Record<string, string>} */ opts) {
  const ref = opts['--form'] || t.meta?.eformId;
  if (!ref) throw new Error('Tài liệu chưa gắn form (eformId) — thêm --form <formId|tên>[,..].');
  const { customer, env } = whereOf(t, opts);
  return loadForms(customer, env, ref);
}

/**
 * Đối chiếu placeholder ↔ field form.
 * @param {string} xml
 * @param {import('../fields').PrintField[]} fields
 */
function compare(xml, fields) {
  const byHash = new Map(fields.map(f => [f.hashid, f]));
  /** @type {Map<string, import('../fields').PrintField[]>} */ const byLabel = new Map();
  fields.forEach(f => byLabel.set(f.label, [...(byLabel.get(f.label) || []), f]));
  const r = {
    ok: /** @type {string[]} */ ([]), other: /** @type {string[]} */ ([]),
    missing: /** @type {string[]} */ ([]),
    /** @type {{ from: string, to: string, why: string }[]} */ fixes: [],
    /** @type {{ name: string, docx: number|null, form: number }[]} */ tables: [],
    used: new Set(),
  };
  for (const p of docx.analyzeXml(xml).placeholders) {
    if (!p.hashid || p.label == null) { r.other.push(p.name); continue; }
    const f = byHash.get(p.hashid);
    if (f) {
      r.used.add(f.hashid);
      const sigOk = f.type === 'signature' && p.label.startsWith(f.label);   // nhãn chữ ký có hậu tố "(Ký xác nhận)"
      if (p.label === f.label || sigOk) r.ok.push(p.name);
      else r.fixes.push({ from: p.name, to: `${f.label} (${f.hashid})`, why: 'sai nhãn' });
      if (f.type === 'table_advance' && p.kind === 'DOCVARIABLE') {
        r.tables.push({ name: p.name, docx: docx.tableColumns(xml, p.name), form: f.columns.length });
      }
      continue;
    }
    const same = byLabel.get(p.label) || [];
    if (same.length === 1) {
      r.used.add(same[0].hashid);
      r.fixes.push({ from: p.name, to: `${same[0].label} (${same[0].hashid})`, why: 'sai hashid' });
    } else {
      r.missing.push(p.name + (same.length > 1 ? `   (nhãn trùng ${same.length} field — sửa tay)`
        : p.kind === 'DOCVARIABLE' ? '   (chữ ký? thêm form duyệt vào --form)' : ''));
    }
  }
  return r;
}

async function cmdCheck(/** @type {ReturnType<typeof openTarget>} */ t, /** @type {Record<string, string>} */ opts, /** @type {Set<string>} */ flags, fix = false) {
  const { forms, fields } = await formsFor(t, opts);
  const r = compare(t.xml, fields);
  console.log(`Đối chiếu ${t.label} ↔ ${forms.map(f => `"${f.formName}"`).join(', ')}  (${fields.length} field form)\n`);
  console.log(`  ✓ khớp: ${r.ok.length}`);
  for (const x of r.fixes) console.log(`  ~ ${x.why}: "${x.from}" → "${x.to}"`);
  for (const x of r.missing) console.log(`  ✗ không có trong form: "${x}"`);
  for (const x of r.tables) {
    const bad = x.docx !== x.form;
    console.log(`  ${bad ? '✗' : '▦'} bảng "${x.name}": docx ${x.docx ?? '?'} cột · form ${x.form} cột${bad ? '  ← LỆCH (col_N theo vị trí cột trong form)' : ''}`);
  }
  if (r.other.length) console.log(`  · bỏ qua ${r.other.length} tên không dạng "Nhãn (hashid)" (col_N…)`);
  const unused = fields.filter(f => !r.used.has(f.hashid) && f.type !== 'splitter');
  console.log(`  · form còn ${unused.length} field chưa đặt vào bản in${flags.has('--all') ? ':' : ' (--all để xem)'}`);
  if (flags.has('--all')) for (const f of unused) console.log(`      ${f.type.padEnd(16)} ${f.label} (${f.hashid})`);

  if (!fix) {
    if (r.fixes.length) console.log(`\n→ ${r.fixes.length} placeholder sửa tự động được: kyta ewriter docx fix ${t.label}`);
    return;
  }
  if (!r.fixes.length) return console.log('\n(không có gì để sửa.)');
  if (flags.has('--dry-run')) return console.log('\n[DRY-RUN] Không ghi.');
  const { xml, count } = docx.renamePlaceholders(t.xml, Object.fromEntries(r.fixes.map(x => [x.from, x.to])));
  t.save(xml);
  console.log(`\n✓ đã sửa ${count} chỗ.`);
}

function cmdRename(/** @type {ReturnType<typeof openTarget>} */ t, /** @type {Record<string, string>} */ opts) {
  if (!opts['--from'] || !opts['--to']) usage(USAGE);
  const { xml, count } = docx.renamePlaceholders(t.xml, { [opts['--from']]: opts['--to'] });
  if (!count) throw new Error(`Không thấy placeholder "${opts['--from']}".`);
  t.save(xml);
  console.log(`✓ đổi ${count} chỗ "${opts['--from']}" → "${opts['--to']}".`);
}

/** Field form theo nhãn | hashid (duy nhất). */
function pickField(/** @type {import('../fields').PrintField[]} */ fields, /** @type {string} */ ref) {
  const hit = fields.filter(f => f.hashid === ref);
  const list = hit.length ? hit : fields.filter(f => f.label === ref).length ? fields.filter(f => f.label === ref)
    : fields.filter(f => f.label.toLowerCase().includes(ref.toLowerCase()));
  if (list.length === 1) return list[0];
  if (!list.length) throw new Error(`Không thấy field "${ref}" trong form.`);
  throw new Error(`"${ref}" khớp ${list.length} field — dùng hashid:\n` + list.map(f => `   ${f.hashid}  ${f.type}  ${f.label}`).join('\n'));
}

async function cmdField(/** @type {ReturnType<typeof openTarget>} */ t, /** @type {Record<string, string>} */ opts) {
  if (!opts['--after'] || (!opts['--var'] && !opts['--field'])) usage(USAGE);
  let name = opts['--var'];
  if (!name) {
    const f = pickField((await formsFor(t, opts)).fields, opts['--field']);
    name = `${f.label} (${f.hashid})`;
  }
  t.save(docx.insertAfterText(t.xml, opts['--after'], rPr => docx.mergefield(name, rPr)));
  console.log(`✓ chèn MERGEFIELD "${name}" sau "${opts['--after']}".`);
}

async function cmdTable(/** @type {ReturnType<typeof openTarget>} */ t, /** @type {Record<string, string>} */ opts) {
  if (!opts['--after'] || !opts['--field']) usage(USAGE);
  const f = pickField((await formsFor(t, opts)).fields, opts['--field']);
  if (f.type !== 'table_advance' || !f.columns.length) throw new Error(`"${f.label}" không phải bảng table_advance có cột.`);
  const n = f.columns.length;
  const given = String(opts['--widths'] || '').split(',').map(Number).filter(Boolean);
  if (given.length && given.length !== n) throw new Error(`--widths có ${given.length} giá trị, bảng có ${n} cột.`);
  const each = Math.floor(docx.textWidth(t.xml) / n);
  const columns = f.columns.map((title, i) => ({ title, width: given[i] || each, align: i === 0 ? 'center' : 'left' }));
  const size = Number(opts['--size'] || 20);
  const name = `${f.label} (${f.hashid})`;
  t.save(docx.insertAfterParagraph(t.xml, opts['--after'], rPr => {
    // Giữ font của đoạn neo, ép cỡ chữ; tiêu đề in đậm.
    const fonts = rPr.match(/<w:rFonts\b[^>]*\/>/)?.[0] || '';
    const sz = `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
    return docx.tableXml({ name, columns, rPr: `<w:rPr>${fonts}${sz}</w:rPr>`, headRPr: `<w:rPr>${fonts}<w:b/><w:bCs/>${sz}</w:rPr>` });
  }));
  console.log(`✓ chèn bảng "${name}" (${n} cột, rộng ${columns.reduce((s, c) => s + c.width, 0)} twips) sau đoạn chứa "${opts['--after']}".`);
}

function cmdInfo(/** @type {ReturnType<typeof openTarget>} */ t) {
  const { placeholders, ifCount, bookmarks } = docx.analyzeXml(t.xml);
  console.log(`Phân tích ${t.label}:\n`);
  for (const kind of ['MERGEFIELD', 'DOCVARIABLE']) {
    const list = placeholders.filter(p => p.kind === kind);
    console.log(`  ${kind}${kind === 'DOCVARIABLE' ? ' (bảng / chữ ký)' : ' (biến)'}: ${list.length}`);
    for (const p of list) console.log(`    • ${p.name}`);
  }
  console.log(`\n  Field IF (điều kiện): ${ifCount}`);
  console.log(`  Bookmark: ${bookmarks.length}${bookmarks.length ? '  ' + bookmarks.join(', ') : ''}`);
}

function cmdStrip(/** @type {ReturnType<typeof openTarget>} */ t) {
  const entries = t.entries.map(e => (e.name === DOC_PART ? { name: e.name, data: Buffer.from(t.xml, 'utf8') } : e));
  const { entries: next, removed } = docx.stripComments(entries);
  const xml = /** @type {Buffer} */ (next.find(e => e.name === DOC_PART)?.data).toString('utf8');
  t.save(xml, next);
  console.log(`✓ gỡ ${removed} comment (+ part comments/people, rels, content-type).`);
}

const SUBS = new Set(['info', 'check', 'fix', 'rename', 'field', 'table', 'strip-comments']);

async function run(/** @type {string[]} */ argv) {
  const { _, flags, opts } = parseArgs(argv, { value: ['--form', '--in', '--from', '--to', '--after', '--var', '--field', '--widths', '--size'] });
  // Tương thích cũ: `kyta ewriter docx <file.docx>` = info.
  const [sub, target] = SUBS.has(_[0]) ? _ : ['info', _[0]];
  if (!target) usage(USAGE);
  const t = openTarget(target);
  if (sub === 'info') return cmdInfo(t);
  if (sub === 'check') return cmdCheck(t, opts, flags);
  if (sub === 'fix') return cmdCheck(t, opts, flags, true);
  if (sub === 'rename') return cmdRename(t, opts);
  if (sub === 'field') return cmdField(t, opts);
  if (sub === 'table') return cmdTable(t, opts);
  if (sub === 'strip-comments') return cmdStrip(t);
  usage(USAGE);
}

module.exports = { run, usage: USAGE, compare };
