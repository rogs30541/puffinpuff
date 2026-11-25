/**
 * 打包成功後自動發布。
 *
 * 兩種模式：
 *   測試版（預設）：npm run release:win
 *     1. git add/commit/push main + tag
 *     2. gh release（repo puffinpuff）上傳 release/PuffinPuff-x.y.z-Setup.exe
 *        + latest.yml + blockmap → 測試版 app 自動更新 feed
 *   公開版：npm run release:public（= 本腳本加 --public）
 *     - 不動 source git（原始碼已由測試版發布時推過）
 *     - gh release（repo puffinpuff-releases）上傳
 *       release-public/PuffinPuff-x.y.z-Public-Setup.exe + latest.yml + blockmap
 *     - ⚠ 只在使用者確認後才跑；公開版安裝檔內建憑證（secrets-public/）
 *
 * 環境要求：
 *   - 已 git init 且設好 remote origin（測試版模式）
 *   - GitHub CLI 已登入
 */

const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const pkg = require('../package.json');

const isPublic = process.argv.includes('--public');
const PUBLIC_REPO = 'rogs30541/puffinpuff-releases';

const version = pkg.version;
const tag = `v${version}`;
const outDir = isPublic ? 'release-public' : 'release';
const assetName = isPublic
  ? `PuffinPuff-${version}-Public-Setup.exe`
  : `PuffinPuff-${version}-Setup.exe`;
const repoFlag = isPublic ? `--repo ${PUBLIC_REPO}` : '';

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

console.log(`\n[release] === ${isPublic ? '公開版' : '測試版'} v${version} 發布 ===`);

if (!isPublic) {
  // ===== 測試版：source git push =====
  const inRepo = safeOutput('git rev-parse --is-inside-work-tree');
  if (inRepo !== 'true') {
    console.error('[release] ❌ 不在 git repo 內，請先 `git init` 並設定 remote');
    process.exit(1);
  }
  const remoteUrl = safeOutput('git remote get-url origin');
  if (!remoteUrl) {
    console.error('[release] ❌ 沒有 remote origin，請先設定：git remote add origin <url>');
    process.exit(1);
  }
  console.log(`[release] remote = ${remoteUrl}`);

  run('git add -A');
  const status = safeOutput('git status --porcelain');
  if (status) {
    console.log(`[release] 偵測到 ${status.split('\n').length} 個檔案變更，建立 commit...`);
    const msg = [
      `v${version} — release build`,
      '',
      '由 release:win 自動 commit（打包成功後）',
      '',
      'Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>'
    ].join('\n');
    run(`git commit -m "${msg.replace(/"/g, '\\"').split('\n').join('" -m "')}"`);
  } else {
    console.log('[release] ✓ 無新變更，跳過 commit（仍會推 tag）');
  }

  run(`git tag -f ${tag}`);
  console.log('[release] 推送 main branch...');
  run('git push origin main');
  console.log(`[release] 推送 tag ${tag}...`);
  run(`git push origin ${tag} --force`);
} else {
  console.log('[release] 公開版模式：跳過 source git push（原始碼由測試版發布時已推送）');
}

// ===== GitHub Release + 上傳 installer / 更新 metadata =====
const installerPath = path.join(__dirname, '..', outDir, assetName);
if (fs.existsSync(installerPath)) {
  const sizeMB = (fs.statSync(installerPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n[release] 發現 installer (${sizeMB} MB)，建立 GitHub Release...`);
  // 先刪舊的同名 Release（若有）— 避免重打包同版本失敗
  try {
    execSync(`gh release delete ${tag} --yes ${repoFlag}`, { stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`[release] 已刪除舊 Release ${tag}`);
  } catch {
    // 沒有舊的，跳過
  }
  // 自動更新需要的檔案一併上傳（latest.yml + blockmap）
  const extraAssets = [];
  const latestYml = path.join(__dirname, '..', outDir, 'latest.yml');
  const blockmap = `${installerPath}.blockmap`;
  if (fs.existsSync(latestYml)) extraAssets.push(`"${latestYml}"`);
  if (fs.existsSync(blockmap)) extraAssets.push(`"${blockmap}"`);

  const releaseNotes = isPublic
    ? `海鸚泡芙 PuffinPuff ${tag}\n\n` +
      `下載 \`${assetName}\` 安裝即可使用 — 憑證已內建，連接帳號不需要自己申請 App。\n` +
      `App 內建自動更新，之後有新版會自動通知。\n\n` +
      `完整變更紀錄：https://github.com/rogs30541/puffinpuff/blob/main/CHANGELOG.md`
    : `PuffinPuff ${tag}\n\n下載 \`${assetName}\` 安裝（App 內建自動更新也會抓此版）。\n\n完整變更紀錄請見 [CHANGELOG.md](../blob/main/CHANGELOG.md)。`;

  console.log(`[release] $ gh release create ${tag} ${repoFlag} ...`);
  execSync(
    `gh release create ${tag} "${installerPath}" ${extraAssets.join(' ')} ${repoFlag} --title "${tag}" --notes-file -`,
    { input: releaseNotes, stdio: ['pipe', 'inherit', 'inherit'] }
  );
  console.log(`[release] ✅ Installer + 更新 metadata（latest.yml/blockmap）已上傳到 Release`);
  const repoUrl = isPublic
    ? `https://github.com/${PUBLIC_REPO}`
    : safeOutput('git remote get-url origin').replace(/\.git$/, '');
  console.log(`\n[release] ✅ ${tag} 發布完成`);
  console.log(`[release] 開啟 ${repoUrl}/releases/tag/${tag} 查看`);
} else {
  console.log(`\n[release] ⚠ 找不到 installer ${installerPath}`);
  if (isPublic) {
    console.log('[release]   請先跑 npm run build:public 產生公開版安裝檔');
    process.exit(1);
  } else {
    console.log('[release]   如果你只跑 git:push（不打包），這是預期；只跑 release:win 才會產 installer');
  }
}
