import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function getArg(name, fallback = '') {
  const hit = args.find((item) => item.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3).trim();
}

function fmtTs(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const envName = getArg('env', 'production');
const version = getArg('version', `${new Date().toISOString().slice(0, 10)}.${fmtTs().slice(-6)}`);
const buildId = getArg('buildId', `${envName}-${fmtTs()}`);
const forceRefresh = getArg('forceRefresh', 'true');
const title = getArg('title', '版本更新说明');
const releasedAt = getArg('releasedAt', '');
const notes = getArg('notes', '新增：运营成本模块上线，支持统一录入与统计口径。');

const manifestArgs = [
  'scripts/update-version-manifest.mjs',
  `--version=${version}`,
  `--buildId=${buildId}`,
  `--forceRefresh=${forceRefresh}`,
  `--title=${title}`,
  `--notes=${notes}`,
];

if (releasedAt) {
  manifestArgs.push(`--releasedAt=${releasedAt}`);
}

const env = {
  ...process.env,
  UMI_ENV: envName,
  APP_VERSION: version,
  APP_BUILD_ID: buildId,
};

const buildScriptMap = {
  development: 'build:dev',
  test: 'build:test',
  pre: 'build:pre',
  production: 'build:prod',
};
const buildScript = buildScriptMap[envName] || 'build:prod';

console.log(`[release] env=${envName}`);
console.log(`[release] version=${version}`);
console.log(`[release] buildId=${buildId}`);

const manifestResult = spawnSync('node', manifestArgs, {
  stdio: 'inherit',
  env,
});
if (manifestResult.status !== 0) {
  process.exit(manifestResult.status || 1);
}

const buildResult = spawnSync('yarn', [buildScript], {
  stdio: 'inherit',
  env,
});
if (buildResult.status !== 0) {
  process.exit(buildResult.status || 1);
}

console.log('[release] done');
