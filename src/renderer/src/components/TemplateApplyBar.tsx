/**
 * v0.6.5：「套用範本 / 存為新範本」工具列
 *
 * 用法：
 *   <TemplateApplyBar
 *     mode="video-reels"
 *     onApply={(template) => { ...用 template 填入 form... }}
 *     getCurrentSnapshot={() => ({ title, description, hashtags, ... })}
 *   />
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Group,
  Select,
  Button,
  Modal,
  TextInput,
  Stack,
  Text
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconClipboardText, IconDeviceFloppy, IconCheck } from '@tabler/icons-react';
import type { ContentTemplate, TemplateMode } from '../../../shared/types';

export interface TemplateApplySnapshot {
  titleTemplate: string | null;
  description: string | null;
  hashtags: string | null;
  privacy: string | null;
}

interface TemplateApplyBarProps {
  /** 當前發布 mode，會用來 filter 顯示哪些範本 */
  mode: TemplateMode;
  /** 套用範本時呼叫 */
  onApply: (template: ContentTemplate) => void;
  /** 「存為範本」時取得當前 form snapshot */
  getCurrentSnapshot: () => TemplateApplySnapshot;
}

export function TemplateApplyBar({ mode, onApply, getCurrentSnapshot }: TemplateApplyBarProps): JSX.Element {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const list = await window.puffin.templates.list();
      // 過濾 mode 對應 + any 通用
      const filtered = list.filter((t) => t.mode === mode || t.mode === 'any');
      setTemplates(filtered);
    } catch (e) {
      console.warn('[template-bar] load failed:', e);
    }
  }, [mode]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleApply = async (id: string | null): Promise<void> => {
    setSelectedId(id);
    if (!id) return;
    const t = templates.find((x) => x.id === parseInt(id, 10));
    if (!t) return;
    onApply(t);
    // 紀錄使用次數
    try {
      await window.puffin.templates.recordUse(t.id);
      await reload();
    } catch {
      /* noop */
    }
    notifications.show({
      title: '已套用範本',
      message: `「${t.name}」內容已填入`,
      color: 'mint',
      icon: <IconCheck size={18} />,
      autoClose: 2500
    });
  };

  const handleSaveAsNew = async (): Promise<void> => {
    if (!newName.trim()) {
      notifications.show({
        title: '請填名稱',
        message: '範本必須有名稱',
        color: 'mango'
      });
      return;
    }
    setSaving(true);
    try {
      const snap = getCurrentSnapshot();
      await window.puffin.templates.create({
        name: newName.trim(),
        mode,
        titleTemplate: snap.titleTemplate,
        description: snap.description,
        hashtags: snap.hashtags,
        privacy: snap.privacy
      });
      notifications.show({
        title: '已存為新範本',
        message: `「${newName.trim()}」可至「範本」頁編輯`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      setShowSaveModal(false);
      setNewName('');
      await reload();
    } catch (e) {
      notifications.show({
        title: '儲存失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setSaving(false);
    }
  };

  const selectData = templates.map((t) => ({
    value: String(t.id),
    label: `${t.mode === 'any' ? '🌐' : t.mode === 'video-reels' ? '🎬' : t.mode === 'image-post' ? '🖼' : '🎠'} ${t.name}${t.useCount > 0 ? ` （已用 ${t.useCount} 次）` : ''}`
  }));

  return (
    <>
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <Select
          label="套用範本"
          placeholder={templates.length === 0 ? '尚無可用範本' : '選擇一個範本一鍵填入'}
          data={selectData}
          value={selectedId}
          onChange={handleApply}
          disabled={templates.length === 0}
          searchable
          leftSection={<IconClipboardText size={16} />}
          style={{ flex: 1 }}
          clearable
        />
        <Button
          variant="light"
          color="walnut"
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={() => setShowSaveModal(true)}
        >
          存為新範本
        </Button>
      </Group>

      <Modal
        opened={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="存當前內容為新範本"
        size="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            把當前的標題模板、描述、hashtag 存成範本，下次可以一鍵套用。
          </Text>
          <TextInput
            label="範本名稱"
            placeholder="例：勞資解析-專業款"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            required
            autoFocus
          />
          <Text size="xs" c="dimmed">
            套用對象 mode：<strong>{mode === 'any' ? '通用' : mode === 'video-reels' ? '影片 Reels' : mode === 'image-post' ? '單圖貼文' : '多圖 Carousel'}</strong>
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setShowSaveModal(false)} disabled={saving}>
              取消
            </Button>
            <Button color="mint" onClick={handleSaveAsNew} loading={saving}>
              建立範本
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
