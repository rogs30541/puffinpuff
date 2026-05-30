/**
 * 圖文批量匯入掃描器
 *
 * A 模式（v0.3.0）：拖入資料夾 → 掃出所有 jpg/png/webp/gif → 找同名 .txt → 配對
 * B 模式（v0.3.1）：資料夾根層有 manifest.csv → 用 CSV 控制每篇獨立 caption/平台/時間/帳號
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, basename } from 'node:path';
import { parse as csvParse } from 'csv-parse/sync';
import { probeImageDimensions } from './imageProbe';
import type { ImageFolderScanResult, ImagePostPair } from '../../shared/types';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const TEXT_EXT = '.txt';
const MANIFEST_NAME = 'manifest.csv';

/** v0.3.1：解析 CSV scheduled_at 欄位，支援多種格式 */
function parseScheduledAt(raw: string): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // 支援 'YYYY-MM-DD HH:MM' / 'YYYY/MM/DD HH:MM' / ISO 8601
  const normalized = trimmed.replace(/\//g, '-').replace(' ', 'T');
  // 沒指定時區 → 視為本機時區（不要加 Z）
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return d.getTime();
}

/** v0.3.1：解析 platforms 欄位 'fb,ig' / 'fb' / 'ig' */
function parsePlatforms(raw: string): ('facebook' | 'instagram')[] {
  if (!raw) return [];
  const tokens = raw
    .toLowerCase()
    .split(/[,\s|;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: ('facebook' | 'instagram')[] = [];
  for (const t of tokens) {
    if (t === 'fb' || t === 'facebook') {
      if (!result.includes('facebook')) result.push('facebook');
    } else if (t === 'ig' || t === 'instagram') {
      if (!result.includes('instagram')) result.push('instagram');
    }
  }
  return result;
}

/**
 * 掃描資料夾並回傳所有「圖文配對」。
 *
 * - A 模式（pair-files）：尋找每個圖檔的同名 .txt 配對
 * - B 模式（csv-manifest）：讀 manifest.csv，每行對應一篇貼文
 *
 * 配對排序：A 模式依檔名自然順序；B 模式依 CSV 列順序
 */
export async function scanImagePostsFolder(folderPath: string): Promise<ImageFolderScanResult> {
  if (!existsSync(folderPath)) {
    throw new Error(`資料夾不存在：${folderPath}`);
  }
  const stat = statSync(folderPath);
  if (!stat.isDirectory()) {
    throw new Error(`不是資料夾：${folderPath}`);
  }

  // 偵測模式：有 manifest.csv → B 模式
  const manifestPath = join(folderPath, MANIFEST_NAME);
  const mode: 'pair-files' | 'csv-manifest' = existsSync(manifestPath)
    ? 'csv-manifest'
    : 'pair-files';

  const entries = readdirSync(folderPath, { withFileTypes: true });
  const warnings: string[] = [];

  if (mode === 'csv-manifest') {
    // B 模式：解析 manifest.csv
    return await scanCsvManifestMode(folderPath, manifestPath, warnings);
  }

  // === A 模式：配對 image + txt ===
  // 1. 列出所有檔案 + 子資料夾
  const imageFiles = new Map<string, string>(); // baseName(lower) → full image filename
  const txtFiles = new Map<string, string>(); // baseName(lower) → full txt filename
  const subFolders: string[] = []; // v0.3.2：子資料夾名（每個 = 一個 carousel）

  for (const entry of entries) {
    if (entry.isDirectory()) {
      subFolders.push(entry.name);
      continue;
    }
    if (!entry.isFile()) continue;
    const name = entry.name;
    const ext = extname(name).toLowerCase();
    const baseName = basename(name, ext); // 不含副檔名
    const baseLower = baseName.toLowerCase(); // 大小寫不分（Windows 慣例）

    if (IMAGE_EXTS.has(ext)) {
      if (imageFiles.has(baseLower)) {
        warnings.push(
          `「${baseName}」有多個圖檔副檔名（如 .jpg + .png），只會用第一個：${imageFiles.get(baseLower)}`
        );
      } else {
        imageFiles.set(baseLower, name);
      }
    } else if (ext === TEXT_EXT) {
      txtFiles.set(baseLower, name);
    }
  }

  // 2. 配對單張圖文（同名 .txt）
  const pairs: ImagePostPair[] = [];
  for (const [baseLower, imageName] of imageFiles) {
    const txtName = txtFiles.get(baseLower);
    if (!txtName) {
      warnings.push(`「${imageName}」沒有對應的 .txt 文字檔，已跳過`);
      continue;
    }
    const imagePath = join(folderPath, imageName);
    const textPath = join(folderPath, txtName);
    const baseName = basename(imageName, extname(imageName));

    let caption: string;
    try {
      caption = readFileSync(textPath, 'utf-8').trim();
    } catch (e) {
      warnings.push(`讀取「${txtName}」失敗：${(e as Error).message}`);
      continue;
    }

    if (!caption) {
      warnings.push(`「${txtName}」是空檔案，已跳過`);
      continue;
    }

    let imageSize = 0;
    try {
      imageSize = statSync(imagePath).size;
    } catch {
      /* noop */
    }

    pairs.push({
      imagePath,
      textPath,
      imageName,
      baseName,
      imageSize,
      caption
    });
  }

  // 3. 偵測孤兒 .txt
  for (const [baseLower, txtName] of txtFiles) {
    if (!imageFiles.has(baseLower)) {
      warnings.push(`「${txtName}」沒有對應的圖檔（jpg/png/webp/gif），已跳過`);
    }
  }

  // 3.5. v0.3.2：掃 subfolder = carousel
  for (const subName of subFolders) {
    const subPath = join(folderPath, subName);
    let subEntries;
    try {
      subEntries = readdirSync(subPath, { withFileTypes: true });
    } catch (e) {
      warnings.push(`讀取子資料夾「${subName}」失敗：${(e as Error).message}`);
      continue;
    }

    const subImages: string[] = []; // 子資料夾內所有圖檔名（要排序）
    let captionFileName: string | null = null;
    for (const e of subEntries) {
      if (!e.isFile()) continue;
      const ext = extname(e.name).toLowerCase();
      if (IMAGE_EXTS.has(ext)) {
        subImages.push(e.name);
      } else if (ext === TEXT_EXT) {
        // 偏好 caption.txt；否則任何 .txt 都可
        if (e.name.toLowerCase() === 'caption.txt') {
          captionFileName = e.name;
        } else if (!captionFileName) {
          captionFileName = e.name;
        }
      }
    }

    if (subImages.length === 0) {
      warnings.push(`子資料夾「${subName}」沒有圖檔，已跳過（無法成為 carousel）`);
      continue;
    }
    if (subImages.length === 1) {
      warnings.push(`子資料夾「${subName}」只有 1 張圖（carousel 需要 2-10 張），已當單張貼文處理`);
    }
    if (subImages.length > 10) {
      warnings.push(`子資料夾「${subName}」有 ${subImages.length} 張圖，超過 IG Carousel 上限 10，只取前 10 張`);
    }
    if (!captionFileName) {
      warnings.push(`子資料夾「${subName}」沒有任何 .txt（建議放 caption.txt），已跳過`);
      continue;
    }

    let caption: string;
    try {
      caption = readFileSync(join(subPath, captionFileName), 'utf-8').trim();
    } catch (e) {
      warnings.push(`讀取「${subName}/${captionFileName}」失敗：${(e as Error).message}`);
      continue;
    }
    if (!caption) {
      warnings.push(`「${subName}/${captionFileName}」是空檔案，已跳過`);
      continue;
    }

    // 圖檔依檔名自然排序
    subImages.sort((a, b) => a.localeCompare(b, 'zh-TW', { numeric: true }));
    const limited = subImages.slice(0, 10);
    const mainImage = limited[0];
    const additional = limited.slice(1).map((n) => join(subPath, n));

    const mainPath = join(subPath, mainImage);
    let imageSize = 0;
    try {
      imageSize = statSync(mainPath).size;
    } catch {
      /* noop */
    }

    pairs.push({
      imagePath: mainPath,
      textPath: join(subPath, captionFileName),
      imageName: `${subName}/${mainImage}`,
      baseName: subName,
      imageSize,
      caption,
      additionalImagePaths: additional.length > 0 ? additional : undefined
    });
  }

  // 4. 自然排序（001 在 010 之前；單張與 carousel 混排依 baseName）
  pairs.sort((a, b) => a.baseName.localeCompare(b.baseName, 'zh-TW', { numeric: true }));

  // 5. 取每張圖的解析度（並發跑加速）
  await Promise.all(
    pairs.map(async (p) => {
      const dim = await probeImageDimensions(p.imagePath);
      if (dim) {
        p.imageWidth = dim.width;
        p.imageHeight = dim.height;
      }
    })
  );

  return {
    folderPath,
    mode,
    pairs,
    warnings
  };
}

/**
 * v0.3.1：B 模式 - 解析 manifest.csv
 *
 * CSV 格式（第 1 列為標題列）：
 *   filename,caption,hashtags,platforms,scheduled_at[,account_alias]
 *
 * 範例：
 *   001.jpg,"今天分享...","#test","fb,ig","2026-06-01 20:00","fb:勞資領航者,ig:everpro.mita02"
 *
 * account_alias 欄為選填：用 displayName 比對；同名多帳號取第一個
 */
async function scanCsvManifestMode(
  folderPath: string,
  manifestPath: string,
  warnings: string[]
): Promise<ImageFolderScanResult> {
  let csvText: string;
  try {
    csvText = readFileSync(manifestPath, 'utf-8');
  } catch (e) {
    warnings.push(`讀取 manifest.csv 失敗：${(e as Error).message}`);
    return { folderPath, mode: 'csv-manifest', pairs: [], warnings };
  }

  // 去 BOM
  if (csvText.charCodeAt(0) === 0xfeff) {
    csvText = csvText.slice(1);
  }

  let rows: Record<string, string>[];
  try {
    rows = csvParse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    }) as Record<string, string>[];
  } catch (e) {
    warnings.push(`manifest.csv 解析失敗：${(e as Error).message}`);
    return { folderPath, mode: 'csv-manifest', pairs: [], warnings };
  }

  const pairs: ImagePostPair[] = [];
  let rowIdx = 0;
  for (const row of rows) {
    rowIdx += 1;
    const rowErrors: string[] = [];

    const filename = (row['filename'] ?? '').trim();
    const caption = (row['caption'] ?? '').trim();
    const hashtags = (row['hashtags'] ?? '').trim();
    const platformsRaw = (row['platforms'] ?? '').trim();
    const scheduledRaw = (row['scheduled_at'] ?? '').trim();
    const accountAlias = (row['account_alias'] ?? '').trim();

    if (!filename) {
      warnings.push(`CSV 第 ${rowIdx} 列 filename 必填，已跳過`);
      continue;
    }

    // v0.3.2：filename 支援 `|` 分隔多張（carousel）
    const filenames = filename.split('|').map((s) => s.trim()).filter(Boolean);
    const mainFilename = filenames[0];
    const additionalFilenames = filenames.slice(1, 10); // IG carousel 上限 10

    if (filenames.length > 10) {
      warnings.push(`CSV 第 ${rowIdx} 列有 ${filenames.length} 張圖，超過 IG Carousel 上限 10，只取前 10 張`);
    }

    const imagePath = join(folderPath, mainFilename);
    if (!existsSync(imagePath)) {
      warnings.push(`CSV 第 ${rowIdx} 列主圖 "${mainFilename}" 找不到，已跳過`);
      continue;
    }
    const stat = statSync(imagePath);
    if (!stat.isFile()) {
      warnings.push(`CSV 第 ${rowIdx} 列 "${mainFilename}" 不是檔案，已跳過`);
      continue;
    }

    // 驗證 additional images 都存在
    const additionalImagePaths: string[] = [];
    for (const f of additionalFilenames) {
      const ap = join(folderPath, f);
      if (existsSync(ap) && statSync(ap).isFile()) {
        additionalImagePaths.push(ap);
      } else {
        warnings.push(`CSV 第 ${rowIdx} 列 carousel 圖 "${f}" 找不到，已忽略`);
      }
    }

    if (!caption) rowErrors.push('caption 必填');
    const platforms = parsePlatforms(platformsRaw);
    if (platforms.length === 0) rowErrors.push('platforms 必填（fb 或 ig）');
    const scheduledAt = parseScheduledAt(scheduledRaw);
    if (scheduledAt === null) rowErrors.push('scheduled_at 格式錯誤（範例：2026-06-01 20:00）');

    const baseName = basename(mainFilename, extname(mainFilename));

    pairs.push({
      imagePath,
      textPath: null,
      imageName: filenames.length > 1 ? `${mainFilename} +${additionalImagePaths.length}` : mainFilename,
      baseName,
      imageSize: stat.size,
      caption,
      additionalImagePaths: additionalImagePaths.length > 0 ? additionalImagePaths : undefined,
      csvHashtags: hashtags,
      csvPlatforms: platforms,
      csvScheduledAt: scheduledAt ?? undefined,
      csvAccountAlias: accountAlias || undefined,
      csvErrors: rowErrors.length > 0 ? rowErrors : undefined
    });
  }

  // 取每張圖解析度
  await Promise.all(
    pairs.map(async (p) => {
      const dim = await probeImageDimensions(p.imagePath);
      if (dim) {
        p.imageWidth = dim.width;
        p.imageHeight = dim.height;
      }
    })
  );

  return {
    folderPath,
    mode: 'csv-manifest',
    pairs,
    warnings
  };
}
