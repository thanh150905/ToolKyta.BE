// @ts-check
'use strict';
const path = require('path');
const fs = require('fs');

/**
 * @typedef {'server_read' | 'server_write' | 'local_read' | 'local_write' | 'high_risk'} Impact
 *
 * @typedef {{
 *   customer?: string,
 *   env?: string,
 *   isProd?: boolean,
 *   resource?: string,
 *   localWritePaths?: string[],
 *   hasForce?: boolean,
 *   hasYes?: boolean,
 *   isDryRun?: boolean,
 * }} CommandTarget
 *
 * @typedef {{
 *   valid: boolean,
 *   module?: string,
 *   command?: string,
 *   subcommand?: string,
 *   impacts: Impact[],
 *   target?: CommandTarget,
 *   error?: string,
 * }} CommandInspection
 */

function parseFolderTarget(folderPath) {
  if (!folderPath) return {};
  const normalized = path.normalize(String(folderPath)).replace(/^(\.\/|\/)/, '');
  const parts = normalized.split(path.sep);
  // Expected pattern: workspace/<customer>/<env>/<module>/...
  let customer, env;
  if (parts[0] === 'workspace' && parts.length >= 3) {
    customer = parts[1];
    env = parts[2];
  } else {
    // Try reading .meta.json if present
    try {
      const metaPath = path.resolve(folderPath, '.meta.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (meta.customer) customer = meta.customer;
        if (meta.env) env = meta.env;
      }
    } catch (_) {}
  }
  const isProd = String(env).toLowerCase() === 'prod';
  return { customer, env, isProd, resource: normalized, localWritePaths: [normalized] };
}

function parseFlags(args) {
  const flags = new Set(args.filter(a => a.startsWith('-')));
  return {
    isDryRun: flags.has('--dry-run'),
    hasForce: flags.has('--force'),
    hasYes: flags.has('--yes') || flags.has('--yes-prod'),
  };
}

/**
 * Kiểm tra và phân loại một lệnh Kyta dựa trên danh mục chính sách tác động.
 * @param {string[]} args Mảng tham số truyền cho kyta CLI (vd: ["eform", "field", "add", ...])
 * @returns {CommandInspection}
 */
function inspectCommand(args) {
  if (!Array.isArray(args) || !args.length) {
    return { valid: false, impacts: [], error: 'Thiếu tham số lệnh.' };
  }

  const [mod, cmd, ...rest] = args;
  const flagInfo = parseFlags(rest);

  // ── Global commands ──
  if (mod === 'login') {
    return {
      valid: true,
      module: 'global',
      command: 'login',
      impacts: ['server_write', 'local_write'],
      target: { ...flagInfo, localWritePaths: ['.kyta/session.json'] },
    };
  }
  if (mod === 'log') {
    return {
      valid: true,
      module: 'global',
      command: 'log',
      impacts: ['local_read'],
      target: { ...flagInfo },
    };
  }
  if (mod === 'help' || mod === '--help' || mod === '-h') {
    return { valid: true, module: 'global', command: 'help', impacts: ['local_read'], target: { ...flagInfo } };
  }

  // ── eForm ──
  if (mod === 'eform') {
    if (!cmd || cmd === 'help') return { valid: true, module: 'eform', command: 'help', impacts: ['local_read'], target: { ...flagInfo } };
    if (cmd === 'list') {
      const [customer, env] = rest;
      return {
        valid: true,
        module: 'eform',
        command: 'list',
        impacts: ['server_read'],
        target: { customer, env, isProd: String(env).toLowerCase() === 'prod', ...flagInfo },
      };
    }
    if (cmd === 'pull') {
      const [customer, env, formId] = rest.filter(x => !x.startsWith('-'));
      return {
        valid: true,
        module: 'eform',
        command: 'pull',
        impacts: ['server_read', 'local_write'],
        target: {
          customer,
          env,
          isProd: String(env).toLowerCase() === 'prod',
          resource: formId || 'all',
          localWritePaths: customer && env ? [`workspace/${customer}/${env}/eform`, 'workspace/registry.json'] : ['workspace'],
          ...flagInfo,
        },
      };
    }
    if (cmd === 'push') {
      const [folder] = rest.filter(x => !x.startsWith('-'));
      const t = parseFolderTarget(folder);
      return { valid: true, module: 'eform', command: 'push', impacts: ['server_write'], target: { ...t, ...flagInfo } };
    }
    if (cmd === 'field') {
      const [sub, folder] = rest;
      const t = parseFolderTarget(folder);
      if (sub === 'list' || sub === 'get') {
        return { valid: true, module: 'eform', command: 'field', subcommand: sub, impacts: ['local_read'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'set') {
        const hasPush = rest.includes('--push');
        return {
          valid: true,
          module: 'eform',
          command: 'field',
          subcommand: 'set',
          impacts: hasPush ? ['local_write', 'server_write'] : ['local_write'],
          target: { ...t, ...flagInfo },
        };
      }
      if (sub === 'add') {
        return { valid: true, module: 'eform', command: 'field', subcommand: 'add', impacts: ['server_write', 'local_write'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'group') {
        return { valid: true, module: 'eform', command: 'field', subcommand: 'group', impacts: ['server_write', 'local_write'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'move') {
        return { valid: true, module: 'eform', command: 'field', subcommand: 'move', impacts: ['server_write', 'local_write'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'delete') {
        return { valid: true, module: 'eform', command: 'field', subcommand: 'delete', impacts: ['server_write', 'local_write', 'high_risk'], target: { ...t, ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Subcommand eform field "${sub}" không tồn tại.` };
    }
    if (cmd === 'childform') {
      const [sub, folder] = rest;
      const t = parseFolderTarget(folder);
      if (sub === 'list') {
        return { valid: true, module: 'eform', command: 'childform', subcommand: 'list', impacts: ['server_read'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'refresh') {
        return { valid: true, module: 'eform', command: 'childform', subcommand: 'refresh', impacts: ['server_write', 'local_write'], target: { ...t, ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Subcommand eform childform "${sub}" không tồn tại.` };
    }
    if (cmd === 'condition') {
      const [sub, folder] = rest;
      const t = parseFolderTarget(folder);
      if (sub === 'list') {
        return { valid: true, module: 'eform', command: 'condition', subcommand: 'list', impacts: ['server_read'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'add') {
        return { valid: true, module: 'eform', command: 'condition', subcommand: 'add', impacts: ['server_write'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'remove') {
        return { valid: true, module: 'eform', command: 'condition', subcommand: 'remove', impacts: ['server_write', 'high_risk'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'toggle') {
        return { valid: true, module: 'eform', command: 'condition', subcommand: 'toggle', impacts: ['server_write'], target: { ...t, ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Subcommand eform condition "${sub}" không tồn tại.` };
    }
    if (cmd === 'status' || cmd === 'diff' || cmd === 'detect' || cmd === 'guard') {
      const [folder] = rest.filter(x => !x.startsWith('-'));
      const t = parseFolderTarget(folder);
      const isDiff = cmd === 'diff';
      return { valid: true, module: 'eform', command: cmd, impacts: isDiff ? ['local_read', 'server_read'] : ['local_read'], target: { ...t, ...flagInfo } };
    }
    if (cmd === 'registry') {
      return { valid: true, module: 'eform', command: 'registry', impacts: ['local_read', 'local_write'], target: { localWritePaths: ['workspace/registry.json'], ...flagInfo } };
    }
  }

  // ── eFlow ──
  if (mod === 'eflow') {
    if (!cmd || cmd === 'help') return { valid: true, module: 'eflow', command: 'help', impacts: ['local_read'], target: { ...flagInfo } };
    if (cmd === 'list') {
      const [customer, env] = rest;
      return { valid: true, module: 'eflow', command: 'list', impacts: ['server_read'], target: { customer, env, isProd: String(env).toLowerCase() === 'prod', ...flagInfo } };
    }
    if (cmd === 'pull') {
      const [customer, env, flowId] = rest.filter(x => !x.startsWith('-'));
      return {
        valid: true,
        module: 'eflow',
        command: 'pull',
        impacts: ['server_read', 'local_write'],
        target: { customer, env, isProd: String(env).toLowerCase() === 'prod', resource: flowId || 'all', localWritePaths: customer && env ? [`workspace/${customer}/${env}/eflow`] : ['workspace'], ...flagInfo },
      };
    }
    if (cmd === 'push') {
      const [folder] = rest.filter(x => !x.startsWith('-'));
      const t = parseFolderTarget(folder);
      return { valid: true, module: 'eflow', command: 'push', impacts: ['server_write'], target: { ...t, ...flagInfo } };
    }
    if (cmd === 'status') {
      return { valid: true, module: 'eflow', command: 'status', impacts: ['local_read'], target: { ...flagInfo } };
    }
    if (cmd === 'nodes') {
      const [folder] = rest.filter(x => !x.startsWith('-'));
      const t = parseFolderTarget(folder);
      return { valid: true, module: 'eflow', command: 'nodes', impacts: ['local_read', 'server_read'], target: { ...t, ...flagInfo } };
    }
    if (cmd === 'roles') {
      const [customer, env] = rest;
      return { valid: true, module: 'eflow', command: 'roles', impacts: ['server_read'], target: { customer, env, isProd: String(env).toLowerCase() === 'prod', ...flagInfo } };
    }
    if (cmd === 'impl') {
      const [folder, sub] = rest.filter(x => !x.startsWith('-'));
      const t = parseFolderTarget(folder);
      if (sub === 'list') {
        return { valid: true, module: 'eflow', command: 'impl', subcommand: 'list', impacts: ['server_read'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'add') {
        return { valid: true, module: 'eflow', command: 'impl', subcommand: 'add', impacts: ['server_write'], target: { ...t, ...flagInfo } };
      }
      if (sub === 'rm' || sub === 'clear') {
        return { valid: true, module: 'eflow', command: 'impl', subcommand: sub, impacts: ['server_write', 'high_risk'], target: { ...t, ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Subcommand eflow impl "${sub}" không tồn tại.` };
    }
    if (cmd === 'notify') {
      const [customer, env, sub] = rest.filter(x => !x.startsWith('-'));
      const isProd = String(env).toLowerCase() === 'prod';
      if (['list-all', 'list', 'templates', 'fields'].includes(sub)) {
        return { valid: true, module: 'eflow', command: 'notify', subcommand: sub, impacts: ['server_read'], target: { customer, env, isProd, ...flagInfo } };
      }
      if (['add', 'set'].includes(sub)) {
        return { valid: true, module: 'eflow', command: 'notify', subcommand: sub, impacts: ['server_write'], target: { customer, env, isProd, ...flagInfo } };
      }
      if (sub === 'rm') {
        return { valid: true, module: 'eflow', command: 'notify', subcommand: 'rm', impacts: ['server_write', 'high_risk'], target: { customer, env, isProd, ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Subcommand eflow notify "${sub}" không tồn tại.` };
    }
  }

  // ── Email ──
  if (mod === 'email') {
    if (!cmd || cmd === 'help') return { valid: true, module: 'email', command: 'help', impacts: ['local_read'], target: { ...flagInfo } };
    if (cmd === 'list') {
      const [customer, env] = rest;
      return { valid: true, module: 'email', command: 'list', impacts: ['server_read'], target: { customer, env, isProd: String(env).toLowerCase() === 'prod', ...flagInfo } };
    }
    if (cmd === 'pull') {
      const [customer, env, id] = rest.filter(x => !x.startsWith('-'));
      return {
        valid: true,
        module: 'email',
        command: 'pull',
        impacts: ['server_read', 'local_write'],
        target: { customer, env, isProd: String(env).toLowerCase() === 'prod', resource: id || 'all', localWritePaths: customer && env ? [`workspace/${customer}/${env}/email`] : ['workspace'], ...flagInfo },
      };
    }
    if (cmd === 'push') {
      const [folder] = rest.filter(x => !x.startsWith('-'));
      const t = parseFolderTarget(folder);
      return { valid: true, module: 'email', command: 'push', impacts: ['server_write'], target: { ...t, ...flagInfo } };
    }
    if (cmd === 'status') {
      return { valid: true, module: 'email', command: 'status', impacts: ['local_read'], target: { ...flagInfo } };
    }
    if (cmd === 'clone') {
      const [srcId, customer, env] = rest.filter(x => !x.startsWith('-'));
      return {
        valid: true,
        module: 'email',
        command: 'clone',
        impacts: ['server_write', 'local_write'],
        target: { customer, env, isProd: String(env).toLowerCase() === 'prod', resource: srcId, localWritePaths: customer && env ? [`workspace/${customer}/${env}/email`] : ['workspace'], ...flagInfo },
      };
    }
  }

  // ── eWriter ──
  if (mod === 'ewriter') {
    if (!cmd || cmd === 'help') return { valid: true, module: 'ewriter', command: 'help', impacts: ['local_read'], target: { ...flagInfo } };
    if (cmd === 'list') {
      const [customer, env] = rest;
      return { valid: true, module: 'ewriter', command: 'list', impacts: ['server_read'], target: { customer, env, isProd: String(env).toLowerCase() === 'prod', ...flagInfo } };
    }
    if (cmd === 'pull') {
      const [customer, env, id] = rest.filter(x => !x.startsWith('-'));
      return {
        valid: true,
        module: 'ewriter',
        command: 'pull',
        impacts: ['server_read', 'local_write'],
        target: { customer, env, isProd: String(env).toLowerCase() === 'prod', resource: id || 'all', localWritePaths: customer && env ? [`workspace/${customer}/${env}/ewriter`] : ['workspace'], ...flagInfo },
      };
    }
    if (cmd === 'push') {
      const [folder] = rest.filter(x => !x.startsWith('-'));
      const t = parseFolderTarget(folder);
      return { valid: true, module: 'ewriter', command: 'push', impacts: ['server_write'], target: { ...t, ...flagInfo } };
    }
    if (cmd === 'changed') {
      return { valid: true, module: 'ewriter', command: 'changed', impacts: ['local_read'], target: { ...flagInfo } };
    }
    if (cmd === 'status') {
      const [folder, newStatus] = rest.filter(x => !x.startsWith('-'));
      const t = parseFolderTarget(folder);
      return { valid: true, module: 'ewriter', command: 'status', impacts: ['server_write'], target: { ...t, resource: newStatus, ...flagInfo } };
    }
    if (cmd === 'clone') {
      const [srcId, customer, env] = rest.filter(x => !x.startsWith('-'));
      return {
        valid: true,
        module: 'ewriter',
        command: 'clone',
        impacts: ['server_write', 'local_write'],
        target: { customer, env, isProd: String(env).toLowerCase() === 'prod', resource: srcId, localWritePaths: customer && env ? [`workspace/${customer}/${env}/ewriter`] : ['workspace'], ...flagInfo },
      };
    }
    if (cmd === 'vars') {
      const [sub] = rest;
      if (sub === 'forms' || sub === 'list') {
        return { valid: true, module: 'ewriter', command: 'vars', subcommand: sub, impacts: ['server_read'], target: { ...flagInfo } };
      }
      if (sub === 'apply') {
        return { valid: true, module: 'ewriter', command: 'vars', subcommand: 'apply', impacts: ['server_write'], target: { ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Subcommand ewriter vars "${sub}" không tồn tại.` };
    }
    if (cmd === 'docx') {
      return { valid: true, module: 'ewriter', command: 'docx', impacts: ['local_read'], target: { ...flagInfo } };
    }
  }

  // ── eCatalog ──
  if (mod === 'ecatalog') {
    if (!cmd || cmd === 'help') return { valid: true, module: 'ecatalog', command: 'help', impacts: ['local_read'], target: { ...flagInfo } };
    if (cmd === 'list') {
      const [customer, env] = rest;
      return { valid: true, module: 'ecatalog', command: 'list', impacts: ['server_read'], target: { customer, env, isProd: String(env).toLowerCase() === 'prod', ...flagInfo } };
    }
    if (cmd === 'pull') {
      const [customer, env, id] = rest.filter(x => !x.startsWith('-'));
      return {
        valid: true,
        module: 'ecatalog',
        command: 'pull',
        impacts: ['server_read', 'local_write'],
        target: { customer, env, isProd: String(env).toLowerCase() === 'prod', resource: id || 'all', localWritePaths: customer && env ? [`workspace/${customer}/${env}/ecatalog`] : ['workspace'], ...flagInfo },
      };
    }
    if (cmd === 'status') {
      return { valid: true, module: 'ecatalog', command: 'status', impacts: ['local_read'], target: { ...flagInfo } };
    }
    if (cmd === 'cat') {
      const [sub, customer, env] = rest.filter(x => !x.startsWith('-'));
      const isProd = String(env).toLowerCase() === 'prod';
      if (['create', 'edit', 'clone', 'apply', 'unapply'].includes(sub)) {
        return { valid: true, module: 'ecatalog', command: 'cat', subcommand: sub, impacts: ['server_write'], target: { customer, env, isProd, ...flagInfo } };
      }
      if (sub === 'rm') {
        return { valid: true, module: 'ecatalog', command: 'cat', subcommand: 'rm', impacts: ['server_write', 'high_risk'], target: { customer, env, isProd, ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Subcommand ecatalog cat "${sub}" không tồn tại.` };
    }
    if (cmd === 'field') {
      const [sub, customer, env] = rest.filter(x => !x.startsWith('-'));
      const isProd = String(env).toLowerCase() === 'prod';
      if (sub === 'list') {
        return { valid: true, module: 'ecatalog', command: 'field', subcommand: 'list', impacts: ['server_read'], target: { customer, env, isProd, ...flagInfo } };
      }
      if (['add', 'set'].includes(sub)) {
        return { valid: true, module: 'ecatalog', command: 'field', subcommand: sub, impacts: ['server_write'], target: { customer, env, isProd, ...flagInfo } };
      }
      if (sub === 'rm') {
        return { valid: true, module: 'ecatalog', command: 'field', subcommand: 'rm', impacts: ['server_write', 'high_risk'], target: { customer, env, isProd, ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Subcommand ecatalog field "${sub}" không tồn tại.` };
    }
    if (cmd === 'display') {
      const [, customer, env] = rest.filter(x => !x.startsWith('-'));
      return { valid: true, module: 'ecatalog', command: 'display', impacts: ['server_write'], target: { customer, env, isProd: String(env).toLowerCase() === 'prod', ...flagInfo } };
    }
    if (cmd === 'data') {
      const [sub, customer, env] = rest.filter(x => !x.startsWith('-'));
      const isProd = String(env).toLowerCase() === 'prod';
      if (sub === 'list') {
        return { valid: true, module: 'ecatalog', command: 'data', subcommand: 'list', impacts: ['server_read'], target: { customer, env, isProd, ...flagInfo } };
      }
      if (['add', 'edit', 'clone'].includes(sub)) {
        return { valid: true, module: 'ecatalog', command: 'data', subcommand: sub, impacts: ['server_write'], target: { customer, env, isProd, ...flagInfo } };
      }
      if (sub === 'rm' || sub === 'clear') {
        return { valid: true, module: 'ecatalog', command: 'data', subcommand: sub, impacts: ['server_write', 'high_risk'], target: { customer, env, isProd, ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Subcommand ecatalog data "${sub}" không tồn tại.` };
    }
  }

  // ── eWorkspace ──
  if (mod === 'eworkspace') {
    if (!cmd || cmd === 'help') return { valid: true, module: 'eworkspace', command: 'help', impacts: ['local_read'], target: { ...flagInfo } };
    if (cmd === 'users') {
      const [customer, env] = rest;
      return { valid: true, module: 'eworkspace', command: 'users', impacts: ['server_read'], target: { customer, env, isProd: String(env).toLowerCase() === 'prod', ...flagInfo } };
    }
    if (cmd === 'dashboard') {
      const [customer, env, action] = rest.filter(x => !x.startsWith('-'));
      const isProd = String(env).toLowerCase() === 'prod';
      if (action === 'add') {
        return { valid: true, module: 'eworkspace', command: 'dashboard', subcommand: 'add', impacts: ['server_write'], target: { customer, env, isProd, ...flagInfo } };
      }
      if (action === 'delete') {
        return { valid: true, module: 'eworkspace', command: 'dashboard', subcommand: 'delete', impacts: ['server_write', 'high_risk'], target: { customer, env, isProd, ...flagInfo } };
      }
      return { valid: false, impacts: [], error: `Hành động eworkspace dashboard "${action}" không tồn tại.` };
    }
    if (cmd === 'preset') {
      const [env, action] = rest.filter(x => !x.startsWith('-'));
      const isProd = String(env).toLowerCase() === 'prod';
      if (action === 'list') {
        return { valid: true, module: 'eworkspace', command: 'preset', subcommand: 'list', impacts: ['local_read'], target: { env, isProd, ...flagInfo } };
      }
      if (['add', 'rename', 'rm'].includes(action)) {
        return {
          valid: true,
          module: 'eworkspace',
          command: 'preset',
          subcommand: action,
          impacts: ['local_write'],
          target: { env, isProd, localWritePaths: ['.kyta/presets.json'], ...flagInfo },
        };
      }
      if (action === 'reset') {
        return {
          valid: true,
          module: 'eworkspace',
          command: 'preset',
          subcommand: 'reset',
          impacts: ['local_write', 'high_risk'],
          target: { env, isProd, localWritePaths: ['.kyta/presets.json'], ...flagInfo },
        };
      }
      return { valid: false, impacts: [], error: `Hành động eworkspace preset "${action}" không tồn tại.` };
    }
  }

  // Lệnh chưa được khai báo
  return {
    valid: false,
    impacts: [],
    error: `Lệnh chưa được khai báo trong danh mục an toàn Kyta: "kyta ${args.join(' ')}". Từ chối thực thi theo mặc định.`,
  };
}

module.exports = {
  inspectCommand,
};
