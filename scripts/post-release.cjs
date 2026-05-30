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

// 7. 若有 installer .exe，自動建 GitHub Release + 上傳 binary
const path = require('node:path');
const fs = require('node:fs');
const installerPath = path.join(__dirname, '..', 'release', `海鸚泡芙 PuffinPuff-${version}-Setup.exe`);
if (fs.existsSync(installerPath)) {
  const sizeMB = (fs.statSync(installerPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n[release] 發現 installer (${sizeMB} MB)，建立 GitHub Release...`);
  console.log(`[release] $ gh release create ${tag} ...`);
  // 先刪舊的同名 Release（若有）— 避免重打包同版本失敗
  try {
    execSync(`gh release delete ${tag} --yes`, { stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`[release] 已刪除舊 Release ${tag}`);
  } catch {
    // 沒有舊的，跳過
  }
  // 建新 Release + 上傳 installer
  const releaseNotes = `PuffinPuff ${tag}\n\n下載 \`海鸚泡芙 PuffinPuff-${version}-Setup.exe\` 安裝。\n\n完整變更紀錄請見 [CHANGELOG.md](../blob/main/CHANGELOG.md)。`;
  // 用 stdin 傳 notes 避免 Windows 命令列轉義問題
  execSync(
    `gh release create ${tag} "${installerPath}" --title "${tag}" --notes-file -`,
    { input: releaseNotes, stdio: ['pipe', 'inherit', 'inherit'] }
  );
  console.log(`[release] ✅ Installer 已上傳到 Release`);
} else {
  console.log(`\n[release] ⚠ 找不到 installer ${installerPath}`);
  console.log('[release]   如果你只跑 git:push（不打包），這是預期；只跑 release:win 才會產 installer');
}

console.log(`\n[release] ✅ ${tag} 已推送到 GitHub`);
console.log(`[release] 開啟 ${remoteUrl.replace(/\.git$/, '')}/releases/tag/${tag} 查看`);
