// @ts-check
'use strict';
// Người thực hiện của user-task: list | add | rm | clear. Quy trình/node nhận tên hoặc id/sid.
const api = require('../api');
const modeler = require('../modeler');
const store = require('../../core/store');
const { idOf } = require('../../core/http');
const { findRole } = require('../lookup');
const { parseArgs, usage, splitList } = require('../../core/args');

const TYPES = ['role', 'creator', 'directManager', 'management', 'step'];
const USAGE = [
  'kyta eflow impl list  <customer> <env> <quy trình> <node>',
  `kyta eflow impl add   <customer> <env> <quy trình> <node> --type <${TYPES.join('|')}> [tuỳ chọn] [--dry-run]`,
  '    role: --role "tên|mã" | --role-id N [--role-name .. --role-code ..] [--role-scope organizationWide]',
  '    directManager/management: [--manager-type creator]     step: --step "sid[,sid]"     chung: [--no-delegation]',
  'kyta eflow impl rm    <customer> <env> <implementerId> [--dry-run]',
  'kyta eflow impl clear <customer> <env> <quy trình> <node> [--dry-run]',
].join('\n');

/**
 * Payload implementer theo kiểu — khớp payload modeler gửi (đã xác minh).
 * @param {import('../modeler').Loaded} m
 * @param {string} userTaskId
 * @param {string} type
 * @param {Record<string, any>} o
 */
function buildImplementer(m, userTaskId, type, o) {
  /** @type {Record<string, any>} */
  const obj = {
    id: null, executorType: type, type: 'internal',
    role: null, roleId: null, position: null, roleScope: null,
    implementationDepartment: null, fieldFormDepartment: null,
    executorId: null, email: null, phoneNumber: null,
    managerType: null, stepExecute: null, level: null,
    fieldForm: null, fieldFormStr: 'null', formUserTask: null,
    externalUser: '', emailExternal: [],
    notificationMethod: '["email"]', authorizationType: '["internal"]',
    delegationOfAuthority: o.delegation !== false,
    condition: false, conditionText: 'null',
    eventMail: [{ key: 'start', value: null }, { key: 'reminder', value: null }, { key: 'completed ', value: null }],
    taskRole: null,
    attributeStr: JSON.stringify({ eventMail: null, taskRole: null, executor: null }),
    processId: m.processId, modelerId: m.id, modelerName: m.name, userTaskId, custId: m.custId,
  };
  if (type === 'role') {
    Object.assign(obj, {
      role: o.roleName, roleId: o.roleId, roleScope: o.roleScope || 'organizationWide',
      position: JSON.stringify({ id: o.roleId, name: o.roleName, code: o.roleCode, custId: m.custId }),
    });
  } else if (type === 'directManager' || type === 'management') {
    obj.managerType = o.managerType || 'creator';
  } else if (type === 'step') {
    obj.stepExecute = o.steps?.length ? o.steps : [userTaskId];
  }
  return obj;
}

/** Mô tả ngắn 1 dòng implementer. */
function describe(/** @type {any} */ x) {
  const who = x.role || x.email
    || (x.managerType && 'manager:' + x.managerType)
    || (x.executorType === 'step' && 'step:' + JSON.stringify(x.stepExecute))
    || (x.executorType === 'creator' && '(người tạo GD)')
    || (x.implementationDepartment && '(phòng ban)')
    || (x.fieldForm && '(theo trường form)') || '';
  return `  ${String(x.id).padEnd(20)} ${String(x.executorType).padEnd(14)} ${who}`;
}

async function run(/** @type {string[]} */ argv) {
  const [action, ...rest] = argv;
  const { _, flags, opts } = parseArgs(rest, {
    value: ['--type', '--role', '--role-id', '--role-name', '--role-code', '--role-scope', '--manager-type', '--step'],
  });
  const dryRun = flags.has('--dry-run');
  const [customer, env, ref, nodeRef] = _;
  if (!customer || !env || !ref) usage(USAGE);
  const sess = await api.open(customer, env);

  if (action === 'rm') {
    const implId = ref;
    if (dryRun) return console.log(`[DRY-RUN] sẽ xoá implementer ${implId}`);
    await api.removeImplementer(sess, implId);
    store.audit({ op: 'eflow-impl-rm', id: implId, customer, env });
    return console.log(`  ✓ đã xoá implementer ${implId}`);
  }

  if (!['list', 'add', 'clear'].includes(action) || !nodeRef) usage(USAGE);
  const m = await modeler.load(sess, ref);
  const node = modeler.findNode(m, nodeRef);
  if (!m.processId) throw new Error(`Không đọc được processId (modelId trong jsonXml) của "${m.name}".`);
  const label = `"${node.name || node.rid}" (${m.name})`;

  if (action === 'list') {
    const rows = await api.implementers(sess, node.rid, m.processId);
    console.log(`Người thực hiện của ${label}: ${rows.length} dòng\n`);
    return rows.forEach(x => console.log(describe(x)));
  }

  if (action === 'clear') {
    const rows = await api.implementers(sess, node.rid, m.processId);
    console.log(`Xoá TẤT CẢ ${rows.length} người thực hiện của ${label}${dryRun ? '   [DRY-RUN]' : ''}`);
    for (const x of rows) {
      if (!dryRun) await api.removeImplementer(sess, x.id);
      console.log(`  ${dryRun ? '[DRY-RUN] ' : '✓ '}xoá ${x.id} (${x.executorType})`);
    }
    if (!dryRun) store.audit({ op: 'eflow-impl-clear', modelerId: m.id, userTaskId: node.rid, n: rows.length, customer, env });
    return;
  }

  // add
  const type = opts['--type'];
  if (!TYPES.includes(type)) usage(USAGE);
  /** @type {Record<string, any>} */
  const o = { delegation: !flags.has('--no-delegation'), managerType: opts['--manager-type'], steps: splitList(opts['--step']) };
  if (type === 'role') {
    if (opts['--role-id']) Object.assign(o, { roleId: Number(opts['--role-id']), roleName: opts['--role-name'], roleCode: opts['--role-code'] });
    else if (opts['--role']) {
      const r = findRole(await api.roles(sess), opts['--role']);
      Object.assign(o, { roleId: r.id, roleName: r.name, roleCode: r.code });
    } else throw new Error('Thiếu role: dùng --role "tên|mã" hoặc --role-id N.');
    o.roleScope = opts['--role-scope'];
  }
  const obj = buildImplementer(m, node.rid, type, o);
  console.log(`Thêm người thực hiện [${type}] vào ${label}${dryRun ? '   [DRY-RUN]' : ''}`);
  if (obj.role) console.log(`  role=${obj.role} (id ${obj.roleId})`);
  if (dryRun) return console.log('\n[DRY-RUN] Không gửi.\n' + JSON.stringify(obj, null, 2).slice(0, 800));
  const id = idOf(await api.addImplementer(sess, obj));
  store.audit({ op: 'eflow-impl-add', modelerId: m.id, userTaskId: node.rid, type, id, customer, env });
  console.log(`  ✓ đã thêm. id = ${id || '(không rõ)'}`);
}

module.exports = { run, usage: USAGE, buildImplementer };
