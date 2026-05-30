/**
 * v0.4.1：監聽資料夾 CRUD（watched_folders 表）
 */

import { execute, insertAndGetId, query, queryOne, flushDatabase } from './database';
import type {
  CreateWatchedFolderInput,
  UpdateWatchedFolderInput,
  WatchedFolder,
  WatcherTemplate
} from '../../shared/types';

interface WatchedFolderRow {
  id: number;
  folder_path: string;
  label: string | null;
  enabled: number;
  template_json: string;
  next_schedule_at: number;
  interval_hours: number;
  last_processed_at: number | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

function toPublic(row: WatchedFolderRow): WatchedFolder {
  let template: WatcherTemplate;
  try {
    template = JSON.parse(row.template_json) as WatcherTemplate;
  } catch {
    template = {
      titleTemplate: '{檔名}',
      description: '',
      hashtags: '',
      privacy: 'public',
      platforms: []
    };
  }
  return {
    id: row.id,
    folderPath: row.folder_path,
    label: row.label,
    enabled: row.enabled === 1,
    template,
    nextScheduleAt: row.next_schedule_at,
    intervalHours: row.interval_hours,
    lastProcessedAt: row.last_processed_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listWatchedFolders(): WatchedFolder[] {
  const rows = query<WatchedFolderRow>(
    'SELECT * FROM watched_folders ORDER BY created_at DESC'
  );
  return rows.map(toPublic);
}

export function getWatchedFolderById(id: number): WatchedFolder | null {
  const row = queryOne<WatchedFolderRow>('SELECT * FROM watched_folders WHERE id = ?', [id]);
  return row ? toPublic(row) : null;
}

export function createWatchedFolder(input: CreateWatchedFolderInput): number {
  const now = Date.now();
  const id = insertAndGetId(
    `INSERT INTO watched_folders (
      folder_path, label, enabled, template_json,
      next_schedule_at, interval_hours, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.folderPath,
      input.label ?? null,
      1,
      JSON.stringify(input.template),
      input.nextScheduleAt,
      input.intervalHours,
      now,
      now
    ]
  );
  flushDatabase();
  return id;
}

export function updateWatchedFolder(input: UpdateWatchedFolderInput): boolean {
  const current = getWatchedFolderById(input.id);
  if (!current) return false;
  const merged = {
    label: input.label ?? current.label,
    enabled: input.enabled ?? current.enabled,
    template: input.template ?? current.template,
    nextScheduleAt: input.nextScheduleAt ?? current.nextScheduleAt,
    intervalHours: input.intervalHours ?? current.intervalHours
  };
  execute(
    `UPDATE watched_folders SET
      label = ?,
      enabled = ?,
      template_json = ?,
      next_schedule_at = ?,
      interval_hours = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      merged.label,
      merged.enabled ? 1 : 0,
      JSON.stringify(merged.template),
      merged.nextScheduleAt,
      merged.intervalHours,
      Date.now(),
      input.id
    ]
  );
  flushDatabase();
  return true;
}

export function deleteWatchedFolder(id: number): void {
  execute('DELETE FROM watched_folders WHERE id = ?', [id]);
  flushDatabase();
}

/** 監聽自動排程後更新 next 與 last_processed */
export function advanceWatchedFolderAfterProcess(
  id: number,
  newNextScheduleAt: number,
  lastError: string | null = null
): void {
  execute(
    `UPDATE watched_folders SET
      next_schedule_at = ?,
      last_processed_at = ?,
      last_error = ?,
      updated_at = ?
    WHERE id = ?`,
    [newNextScheduleAt, Date.now(), lastError, Date.now(), id]
  );
  flushDatabase();
}
