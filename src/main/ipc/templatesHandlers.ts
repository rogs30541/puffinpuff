/**
 * v0.6.1：內文範本 IPC
 */
import { ipcMain } from 'electron';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  recordTemplateUse,
  type ContentTemplate,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type TemplateMode
} from '../lib/templatesRepo';

export function registerTemplatesHandlers(): void {
  ipcMain.handle(
    'templates:list',
    (_e, modeFilter?: TemplateMode): ContentTemplate[] => listTemplates(modeFilter)
  );

  ipcMain.handle(
    'templates:get',
    (_e, id: number): ContentTemplate | null => getTemplate(id)
  );

  ipcMain.handle(
    'templates:create',
    (_e, input: CreateTemplateInput): number => createTemplate(input)
  );

  ipcMain.handle(
    'templates:update',
    (_e, input: UpdateTemplateInput): boolean => updateTemplate(input)
  );

  ipcMain.handle(
    'templates:delete',
    (_e, id: number): boolean => deleteTemplate(id)
  );

  ipcMain.handle(
    'templates:duplicate',
    (_e, id: number, newName?: string): number => duplicateTemplate(id, newName)
  );

  ipcMain.handle(
    'templates:recordUse',
    (_e, id: number): boolean => {
      recordTemplateUse(id);
      return true;
    }
  );
}
