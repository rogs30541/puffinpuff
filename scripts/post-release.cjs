/**
 * 打包成功後自動 commit + tag + push 到 GitHub。
 *
 * 流程：
 *   1. git add -A（所有變更）
 *   2. 若有變更才 commit（避免空 commit）
 *   3. tag v<version>（強制覆寫，允許同版本重建）
 *   4. push main + tag
 *
 * 觸發方式：
 *   npm run release:win    （= build:win 完成後自動跑這支）
 *
 * 環境要求：
 *   - 已 git init 且設好 remote origin
 *   - GitHub CLI 已登入 或 git credentials 已設好
 */

const { execSync } = require('node:child_process');
const pkg = require('../package.json');

const version = pkg.version;
const tag = `v${version}`;

function run(cmd, opts = {}) {
  console.log(`[release] $ ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function safeOutput(cmd) {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } catch {
    return '';
  }
}

console.log(`\n[release] === 自動推送 v${version} 到 GitHub ===`);

// 1. 確認在 git repo 內
const inRepo = safeOutput('git rev-parse --is-inside-work-tree');
if (inRepo !== 'true') {
  console.error('[release] ❌ 不在 git repo 內，請先 `git init` 並設定 remote');
  process.exit(1);
}

// 2. 確認有 remote
const remoteUrl = safeOutput('git remote get-url origin');
if (!remoteUrl) {
  console.error('[release] ❌ 沒有 remote origin，請先設定：git remote add origin <url>');
  process.exit(1);
}
console.log(`[release] remote = ${remoteUrl}`);

// 3. stage 所有變更
run('git add -A');

// 4. 檢查是否真的有東西要 commit（避免空 commit）
const status = safeOutput('git status --porcelain');
if (status) {
  console.log(`[release] 偵測到 ${status.split('\n').length} 個檔案變更，建立 commit...`);
  // 用 HEREDOC 風格的 multi-line message
  const msg = [
    `v${version} — release build`,
    '',
    '由 release:win 自動 commit（打包成功後）',
    '',
    'Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>'
  ].join('\n');
  // Windows 用 -m "..." 較穩，避免 heredoc
  run(`git commit -m "${msg.replace(/"/g, '\\"').split('\n').join('" -m "')}"`);
} else {
  console.log('[release] ✓ 無新變更，跳過 commit（仍會推 tag）');
}

// 5. 打 tag（force 允許同版本重建覆蓋）
run(`git tag -f ${tag}`);

// 6. push main + tag
console.log('[release] 推送 main branch...');
run('git push origin main');

console.log(`[release] 推送 tag ${tag}...`);
run(`git push origin ${tag} --force`);

console.log(`\n[release] ✅ ${tag} 已推送到 GitHub`);
console.log(`[release] 開啟 ${remoteUrl.replace(/\.git$/, '')}/releases/tag/${tag} 查看`);
