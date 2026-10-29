// @ts-check
'use strict';
// Cấu hình thông báo node eNotify (template-config-mails): mẫu mail, tiêu đề, người nhận, thời điểm gửi.
const api = require('../api');
const modeler = require('../modeler');
const store = require('../../core/store');
const { idOf } = require('../../core/http');
const { grep } = require('../../core/pick');
const { findRole, findTemplate, findEForm, formFields, findField } = require('../lookup');
const { parseArgs, usage, splitList } = require('../../core/args');

const RECV = '--recv-user "email,.." | --recv-role "tên|mã,.." | --recv-step "<node>,.." | --recv-form "form" --recv-field "trường" | --recv-copy-from <config-id>';
const USAGE = [
  'kyta eflow notify list-all  <customer> <env> <quy trình> [--grep "mẫu/tiêu đề"]',
  'kyta eflow notify list      <customer> <env> <quy trình> <node> | --after "<node>"',
  'kyta eflow notify templates <customer> <env> [--grep "x"]',
  'kyta eflow notify fields    <customer> <env> <quy trình> --form "tên|mã|id" [--grep "x"]',
  'kyta eflow notify add       <customer> <env> <quy trình> <node>|--after "<node>" --template "tên|id" <người nhận> [--subject ".."] [thời điểm] [--dry-run]',
  'kyta eflow notify set       <customer> <env> <quy trình> <node>|--after "<node>" [--config-id ID] [--template ..] [--subject ..] [<người nhận>] [thời điểm] [--dry-run]',
  'kyta eflow notify rm        <customer> <env> <config-id> [--dry-run]',
  `  người nhận: ${RECV}`,
  '  thời điểm:  --time-from-ticket (mặc định khi add) | --time-after-step "<node>"',
].join('\n');

const VALUE_OPTS = ['--grep', '--template', '--subject', '--config-id', '--after', '--form', '--time-after-step',
  '--recv-user', '--recv-role', '--recv-step', '--recv-form', '--recv-field', '--recv-copy-from'];

/** @typedef {import('../modeler').Loaded} Loaded */

/** Dòng mô tả 1 cấu hình thông báo. */
const describe = (/** @type {any} */ c) =>
  `  ${String(c.id).padEnd(20)} [${String(c.type || 'email').padEnd(5)}] recv:${String(c.infoReceiver?.type || '?').padEnd(8)} "${c.subject || ''}"  ← ${c.templateName || c.templateId || ''}`;

/** infoReceiver rỗng theo khung server yêu cầu. */
const receiver = (/** @type {string} */ type, /** @type {Record<string, any>} */ part) =>
  ({ type, department: null, infoPerson: null, email: null, roles: null, fields: null, userTaskIds: null, ...part });

/**
 * Dựng infoReceiver từ các cờ --recv-*. Không có cờ nào → null.
 * @param {import('../api').Session} sess
 * @param {Loaded} m
 * @param {Record<string, string>} opts
 */
async function buildReceiver(sess, m, opts) {
  if (opts['--recv-copy-from']) {
    for (const n of m.nodes.filter(x => x.stencil === 'eNotify')) {
      const src = (await api.notifyConfigs(sess, m.id, n.rid)).find(x => x.id === opts['--recv-copy-from']);
      if (src) return { recv: src.infoReceiver, desc: `sao chép từ ${src.id} (${src.infoReceiver?.type})` };
    }
    throw new Error(`Không thấy config id "${opts['--recv-copy-from']}" để sao chép người nhận.`);
  }
  if (opts['--recv-form'] && opts['--recv-field']) {
    const form = findEForm(await api.eforms(sess, m.id), opts['--recv-form']);
    const f = findField(form, opts['--recv-field']);
    const field = {
      name: `Form: ${form.formName} - ${form.formCode}- Field: ${f.label}`,   // đúng định dạng modeler sinh
      type: f.type, formId: form.formId, hashid: f.hashid, fieldId: f.id,
      modelerId: m.id, versionId: form.versionId, userTaskId: null,
    };
    return { recv: receiver('form', { fields: [field] }), desc: `trường form ${f.id}` };
  }
  if (opts['--recv-user']) {
    const all = await api.users(sess);
    const infoPerson = splitList(opts['--recv-user']).map(email => {
      const u = all.find(x => String(x.email || '').toLowerCase() === email.toLowerCase());
      if (!u) throw new Error(`Không thấy user email "${email}".`);
      return { email: u.email, orgIn: u.orgIn, phone: u.phone || null, avatar: u.avatar || '', custId: u.custId, userId: u.resourceId, fullName: u.personalName, haveAvatar: !!u.avatar };
    });
    return { recv: receiver('account', { infoPerson }), desc: `account: ${infoPerson.map(p => p.fullName).join(', ')}` };
  }
  if (opts['--recv-role']) {
    const all = await api.roles(sess);
    const roles = splitList(opts['--recv-role']).map(ref => {
      const r = findRole(all, ref);
      return { id: r.id, code: r.code, name: r.name, custId: r.custId };
    });
    return { recv: receiver('role', { roles }), desc: `role: ${roles.map(r => r.name).join(', ')}` };
  }
  if (opts['--recv-step']) {
    const userTaskIds = splitList(opts['--recv-step']).map(ref => modeler.findNode(m, ref).rid);
    return { recv: receiver('implementStep', { userTaskIds }), desc: `theo bước: ${userTaskIds.join(', ')}` };
  }
  return null;
}

/** configTime: gửi tính từ lúc tạo ticket, hoặc sau khi kết thúc 1 bước. */
function configTime(/** @type {Loaded} */ m, /** @type {string|undefined} */ afterStep) {
  const base = { startTime: '1970-01-01T00:00:00.000Z', field: null, cycleTime: 0, cycleTimeISO: 'R0', durationTime: 0, durationTimeISO: '', typeSendTime: 'after' };
  if (!afterStep) return { ...base, type: 'createdDateTicket', userTaskId: null };
  const step = modeler.findNode(m, afterStep);
  return { ...base, type: 'endStep', userTaskId: step.rid, stepName: step.name || step.rid };
}

async function run(/** @type {string[]} */ argv) {
  const [action, ...rest] = argv;
  const { _, flags, opts } = parseArgs(rest, { value: VALUE_OPTS });
  const dryRun = flags.has('--dry-run');
  const [customer, env, ref, nodeRef] = _;
  if (!customer || !env) usage(USAGE);
  const sess = await api.open(customer, env);

  if (action === 'templates') {
    const all = await api.templates(sess);
    const rows = grep(all, opts['--grep'], ['name']);
    console.log(`${rows.length}/${all.length} mẫu mail ở ${customer}/${env}:\n`);
    return rows.forEach(t => console.log(`  ${String(t.id).padEnd(20)} ${t.name || ''}`));
  }

  if (action === 'rm') {
    if (!ref) usage(USAGE);
    if (dryRun) return console.log(`[DRY-RUN] sẽ xoá config ${ref}`);
    await api.removeNotifyConfig(sess, ref);
    store.audit({ op: 'eflow-notify-rm', id: ref, customer, env });
    return console.log(`  ✓ đã xoá config ${ref}`);
  }

  if (!ref || !['list-all', 'fields', 'list', 'add', 'set'].includes(action)) usage(USAGE);
  const m = await modeler.load(sess, ref);

  if (action === 'list-all') {
    const nodes = m.nodes.filter(n => n.stencil === 'eNotify');
    let total = 0, shown = 0;
    console.log(`Tất cả eNotify của "${m.name}" (${nodes.length} node):\n`);
    for (const n of nodes) {
      const rows = await api.notifyConfigs(sess, m.id, n.rid);
      const hit = grep(rows, opts['--grep'], ['templateName', 'subject']);
      total += rows.length;
      if (opts['--grep'] && !hit.length) continue;
      shown += hit.length;
      console.log(`● ${n.rid}${rows.length ? '' : '   (chưa cấu hình)'}`);
      hit.forEach(c => console.log(describe(c)));
    }
    return console.log(`\nTổng: ${total} dòng config trên ${nodes.length} node${opts['--grep'] ? ` (khớp "${opts['--grep']}": ${shown})` : ''}.`);
  }

  if (action === 'fields') {
    if (!opts['--form']) usage(USAGE);
    const form = findEForm(await api.eforms(sess, m.id), opts['--form']);
    const fields = grep(formFields(form), opts['--grep'], ['label']);
    console.log(`Trường của form "${form.formName}" (${form.formCode || form.formId}): ${fields.length}\n`);
    return fields.forEach(x => console.log(`  [${String(x.type).padEnd(14)}] ${String(x.label).padEnd(45)} ${x.id}`));
  }

  // list | add | set: định vị node eNotify theo --after "<node trước>" hoặc tên/sid trực tiếp.
  if (!nodeRef && !opts['--after']) usage(USAGE);
  const node = opts['--after'] ? modeler.findAfter(m, opts['--after']) : modeler.findNode(m, nodeRef);
  const where = `"${node.name || node.rid}" [${node.stencil}] (${m.name})`;

  if (action === 'list') {
    const rows = await api.notifyConfigs(sess, m.id, node.rid);
    console.log(`Cấu hình thông báo của ${where}: ${rows.length} dòng\n`);
    return rows.forEach(c => console.log(describe(c)));
  }

  const recv = await buildReceiver(sess, m, opts);
  const template = opts['--template'] ? findTemplate(await api.templates(sess), opts['--template']) : null;
  const afterStep = opts['--time-after-step'];

  /** @type {any} */ let obj;
  const changes = [];
  if (action === 'add') {
    if (!template || !recv) usage(USAGE);
    obj = {
      id: null, modelerId: m.id, userTaskId: node.rid,
      templateId: template.id, templateName: template.name, type: 'email', subject: opts['--subject'] || '',
      mailType: 'system_email', brandName: null, accountZalo: null, zaloId: null, phoneNumber: null,
      infoReceiver: recv.recv, subsystem: null, conditionText: null, inheritField: null,
      configTime: configTime(m, afterStep), document: [],
    };
    changes.push(`mẫu "${template.name}"`, `tiêu đề "${obj.subject}"`, `người nhận ${recv.desc}`, `thời điểm ${obj.configTime.type}`);
  } else {
    // set: sửa 1 dòng có sẵn — node nhiều dòng thì phải chỉ định --config-id.
    const rows = await api.notifyConfigs(sess, m.id, node.rid);
    if (!rows.length) throw new Error(`Node ${where} chưa có dòng cấu hình nào — dùng notify add.`);
    const target = opts['--config-id'] ? rows.find(r => r.id === opts['--config-id']) : rows.length === 1 ? rows[0] : null;
    if (!target) throw new Error(opts['--config-id'] ? `Không thấy config id "${opts['--config-id']}".` : `Node có ${rows.length} dòng — chỉ định --config-id:\n${rows.map(describe).join('\n')}`);
    obj = api.cleanNotifyConfig(target);
    if (template) { obj.templateId = template.id; obj.templateName = template.name; changes.push(`mẫu → "${template.name}"`); }
    if (opts['--subject']) { obj.subject = opts['--subject']; changes.push(`tiêu đề → "${obj.subject}"`); }
    if (recv) { obj.infoReceiver = recv.recv; changes.push(`người nhận → ${recv.desc}`); }
    if (flags.has('--time-from-ticket') || afterStep) { obj.configTime = configTime(m, afterStep); changes.push(`thời điểm → ${obj.configTime.type}`); }
    if (!changes.length) usage(USAGE);
  }
  // stepName chỉ để in log, không gửi lên server.
  if (obj.configTime?.stepName) { changes.push(`(sau bước "${obj.configTime.stepName}")`); delete obj.configTime.stepName; }

  console.log(`${action === 'add' ? 'Tạo' : 'Sửa'} cấu hình thông báo @ ${where}${dryRun ? '   [DRY-RUN]' : ''}`);
  changes.forEach(c => console.log('  ' + c));
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi.\n' + JSON.stringify(obj, null, 1).slice(0, 900));

  const r = await api.saveNotifyConfig(sess, obj, action === 'add' ? 'POST' : 'PUT');
  const id = obj.id || idOf(r);
  store.audit({ op: `eflow-notify-${action}`, modelerId: m.id, userTaskId: node.rid, id, customer, env });
  console.log(`  ✓ đã lưu. id = ${id || '(không rõ — xem notify list)'}`);
}

module.exports = { run, usage: USAGE };
