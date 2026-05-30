/**
 * v0.6.1：內文範本 CRUD
 * 讓使用者把常用標題/描述/hashtag/平台設定存成範本，下次套用即可
 */
import { execute, query, queryOne, insertAndGetId } from './database';

export type TemplateMode = 'any' | 'video-reels' | 'image-post' | 'carousel';

export interface ContentTemplate {
  id: number;
  name: string;
  mode: TemplateMode;
  titleTemplate: string | null;
  description: string | null;
  hashtags: string | null;
  privacy: string | null;
  /** 各平台覆寫設定（JSON 字串）*/
  perPlatformJson: string | null;
  /** 目標帳號（JSON: {youtube:1, facebook:2, instagram:3}）*/
  targetAccountsJson: string | null;
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateTemplateInput {
  name: string;
  mode?: TemplateMode;
  titleTemplate?: string | null;
  description?: string | null;
  hashtags?: string | null;
  privacy?: string | null;
  perPlatformJson?: string | null;
  targetAccountsJson?: string | null;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: number;
}

interface TemplateRow {
  id: number;
  name: string;
  mode: string;
  title_template: string | null;
  description: string | null;
  hashtags: string | null;
  privacy: string | null;
  per_platform_json: string | null;
  target_accounts_json: string | null;
  use_count: number;
  last_used_at: number | null;
  created_at: number;
  updated_at: number;
}

function rowToTemplate(row: TemplateRow): ContentTemplate {
  return {
    id: row.id,
    name: row.name,
    mode: (row.mode as TemplateMode) ?? 'any',
    titleTemplate: row.title_template,
    description: row.description,
    hashtags: row.hashtags,
    privacy: row.privacy,
    perPlatformJson: row.per_platform_json,
    targetAccountsJson: row.target_accounts_json,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listTemplates(modeFilter?: TemplateMode): ContentTemplate[] {
  // 預設排序：最常用優先，再依最近使用、再依建立時間
  const sql = modeFilter
    ? `SELECT * FROM content_templates WHERE mode = ? OR mode = 'any'
       ORDER BY use_count DESC, last_used_at DESC, id DESC`
    : `SELECT * FROM content_templates
       ORDER BY use_count DESC, last_used_at DESC, id DESC`;
  const params = modeFilter ? [modeFilter] : [];
  return query<TemplateRow>(sql, params).map(rowToTemplate);
}

export function getTemplate(id: number): ContentTemplate | null {
  const row = queryOne<TemplateRow>(
    'SELECT * FROM content_templates WHERE id = ?',
    [id]
  );
  return row ? rowToTemplate(row) : null;
}

export function createTemplate(input: CreateTemplateInput): number {
  const now = Date.now();
  const name = input.name.trim();
  if (!name) throw new Error('範本名稱為空');
  if (name.length > 60) throw new Error('範本名稱過長（最多 60 字元）');
  return insertAndGetId(
    `INSERT INTO content_templates
       (name, mode, title_template, description, hashtags, privacy, per_platform_json, target_accounts_json, use_count, last_used_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
    [
      name,
      input.mode ?? 'any',
      input.titleTemplate ?? null,
      input.description ?? null,
      input.hashtags ?? null,
      input.privacy ?? null,
      input.perPlatformJson ?? null,
      input.targetAccountsJson ?? null,
      now,
      now
    ]
  );
}

export function updateTemplate(input: UpdateTemplateInput): boolean {
  const existing = getTemplate(input.id);
  if (!existing) return false;
  const now = Date.now();
  const name = (input.name ?? existing.name).trim();
  if (!name) throw new Error('範本名稱為空');
  execute(
    `UPDATE content_templates SET
       name = ?,
       mode = ?,
       title_template = ?,
       description = ?,
       hashtags = ?,
       privacy = ?,
       per_platform_json = ?,
       target_accounts_json = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      name,
      input.mode ?? existing.mode,
      input.titleTemplate !== undefined ? input.titleTemplate : existing.titleTemplate,
      input.description !== undefined ? input.description : existing.description,
      input.hashtags !== undefined ? input.hashtags : existing.hashtags,
      input.privacy !== undefined ? input.privacy : existing.privacy,
      input.perPlatformJson !== undefined ? input.perPlatformJson : existing.perPlatformJson,
      input.targetAccountsJson !== undefined ? input.targetAccountsJson : existing.targetAccountsJson,
      now,
      input.id
    ]
  );
  return true;
}

export function deleteTemplate(id: number): boolean {
  execute('DELETE FROM content_templates WHERE id = ?', [id]);
  return true;
}

export function duplicateTemplate(id: number, newName?: string): number {
  const src = getTemplate(id);
  if (!src) throw new Error(`找不到範本 id=${id}`);
  const name = (newName ?? `${src.name} (複製)`).slice(0, 60);
  return createTemplate({
    name,
    mode: src.mode,
    titleTemplate: src.titleTemplate,
    description: src.description,
    hashtags: src.hashtags,
    privacy: src.privacy,
    perPlatformJson: src.perPlatformJson,
    targetAccountsJson: src.targetAccountsJson
  });
}

export function recordTemplateUse(id: number): void {
  execute(
    `UPDATE content_templates SET use_count = use_count + 1, last_used_at = ? WHERE id = ?`,
    [Date.now(), id]
  );
}
