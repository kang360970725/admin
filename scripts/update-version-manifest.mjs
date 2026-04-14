import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function getArg(name, fallback = '') {
  const hit = args.find((item) => item.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3).trim();
}

function getNowString() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

const version = getArg('version', process.env.APP_VERSION || '0.0.0');
const buildId = getArg('buildId', process.env.APP_BUILD_ID || `manual-${Date.now()}`);
const forceRefreshRaw = getArg('forceRefresh', 'true');
const forceRefresh = forceRefreshRaw !== 'false';
const title = getArg('title', '版本更新说明');
const releasedAt = getArg('releasedAt', getNowString());

// 说明支持通过 `|` 传多条，未传时使用默认模板（首条为运营成本）
const notesArg = getArg('notes', '').trim();
const notes = notesArg
  ? notesArg.split('|').map((item) => item.trim()).filter(Boolean)
  : [
      '新增：运营成本模块上线，支持统一录入与统计口径。',
      '优化：消息中心支持右上角弱提示叠加与快捷跳转。',
    ];

const manifest = {
  version,
  buildId,
  releasedAt,
  forceRefresh,
  title,
  notes,
};

const target = path.resolve(process.cwd(), 'public/version-manifest.json');
fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`version-manifest updated: ${target}`);
