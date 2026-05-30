/**
 * v0.6.1：內文範本管理頁
 *
 * 功能：
 *  - 列出所有範本（按使用次數 + 最近使用排序）
 *  - 新增 / 編輯 / 刪除 / 複製範本
 *  - 範本內容：名稱、適用 mode、標題模板、描述、hashtag、隱私設定
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Group,
  Button,
  Card,
  Badge,
  Modal,
  TextInput,
  Textarea,
  Select,
  ActionIcon,
  Divider,
  Code,
  Alert
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconCopy,
  IconClipboardText,
  IconAlertCircle,
  IconCheck
} from '@tabler/icons-react';
import type {
  ContentTemplate,
  CreateTemplateInput,
  TemplateMode
} from '../../../shared/types';

const MODE_LABELS: Record<TemplateMode, string> = {
  'any': '通用（任意模式）',
  'video-reels': '影片 Reels',
  'image-post': '單圖貼文',
  'carousel': '多圖 Carousel'
};
const MODE_COLORS: Record<TemplateMode, string> = {
  'any': 'walnut',
  'video-reels': 'sky',
  'image-post': 'mango',
  'carousel': 'lavender'
};

export function TemplatesPage(): JSX.Element {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContentTemplate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentTemplate | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.puffin.templates.list();
      setTemplates(list);
    } catch (e) {
      notifications.show({
        title: '載入範本失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await window.puffin.templates.delete(deleteTarget.id);
      notifications.show({
        title: '已刪除',
        message: `範本「${deleteTarget.name}」已刪除`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      notifications.show({
        title: '刪除失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  const handleDuplicate = async (t: ContentTemplate): Promise<void> => {
    try {
      await window.puffin.templates.duplicate(t.id);
      notifications.show({
        title: '已複製',
        message: `複製「${t.name}」為新範本`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      await reload();
    } catch (e) {
      notifications.show({
        title: '複製失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <IconClipboardText size={28} color="#7C736B" />
          <Title order={2} c="walnut.8">內文範本</Title>
          <Badge variant="light" color="mint">{templates.length}</Badge>
        </Group>
        <Button
          color="mint"
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowCreateModal(true)}
        >
          新增範本
        </Button>
      </Group>

      <Text size="sm" c="dimmed">
        儲存常用的標題、描述、hashtag，發布時一鍵套用，不用每次重 key。
        標題模板支援變數：<Code>{'{filename}'}</Code>（檔名，自動去除前綴編號 / 日期）。
      </Text>

      {loading && <Text size="sm" c="dimmed">載入中...</Text>}

      {!loading && templates.length === 0 && (
        <Alert color="walnut" variant="light" icon={<IconAlertCircle size={18} />}>
          還沒建立任何範本。點右上「新增範本」開始 — 之後在發布頁 / 批量匯入 / 排程都能一鍵套用。
        </Alert>
      )}

      {templates.map((t) => (
        <Card key={t.id} padding="md" withBorder>
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={4} style={{ flex: 1 }}>
                <Group gap="xs">
                  <Text fw={600} size="md" c="walnut.8">{t.name}</Text>
                  <Badge color={MODE_COLORS[t.mode]} variant="light" size="sm">
                    {MODE_LABELS[t.mode]}
                  </Badge>
                  {t.useCount > 0 && (
                    <Badge color="dimmed" variant="light" size="xs">
                      已用 {t.useCount} 次
                    </Badge>
                  )}
                </Group>
                {t.titleTemplate && (
                  <Text size="xs" c="dimmed">
                    <strong>標題：</strong>{t.titleTemplate}
                  </Text>
                )}
                {t.description && (
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    <strong>描述：</strong>{t.description}
                  </Text>
                )}
                {t.hashtags && (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    <strong>Hashtag：</strong>{t.hashtags}
                  </Text>
                )}
                {t.lastUsedAt && (
                  <Text size="xs" c="dimmed">
                    最後使用：{new Date(t.lastUsedAt).toLocaleString('zh-TW')}
                  </Text>
                )}
              </Stack>
              <Group gap="xs">
                <ActionIcon
                  variant="light"
                  color="sky"
                  size="md"
                  onClick={() => setEditing(t)}
                  title="編輯"
                >
                  <IconEdit size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="walnut"
                  size="md"
                  onClick={() => handleDuplicate(t)}
                  title="複製"
                >
                  <IconCopy size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="red"
                  size="md"
                  onClick={() => setDeleteTarget(t)}
                  title="刪除"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
          </Stack>
        </Card>
      ))}

      {/* 新增 Modal */}
      <TemplateEditorModal
        opened={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        existing={null}
        onSaved={async () => {
          setShowCreateModal(false);
          await reload();
        }}
      />

      {/* 編輯 Modal */}
      <TemplateEditorModal
        opened={!!editing}
        onClose={() => setEditing(null)}
        existing={editing}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
      />

      {/* 刪除確認 Modal */}
      <Modal
        opened={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="確認刪除範本"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            確定要刪除範本「<strong>{deleteTarget?.name}</strong>」？此動作無法復原。
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button color="red" onClick={handleDelete}>
              確認刪除
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

interface TemplateEditorModalProps {
  opened: boolean;
  onClose: () => void;
  existing: ContentTemplate | null;
  onSaved: () => Promise<void>;
}

function TemplateEditorModal({ opened, onClose, existing, onSaved }: TemplateEditorModalProps): JSX.Element {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TemplateMode>('any');
  const [titleTemplate, setTitleTemplate] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setMode(existing.mode);
      setTitleTemplate(existing.titleTemplate ?? '');
      setDescription(existing.description ?? '');
      setHashtags(existing.hashtags ?? '');
    } else {
      setName('');
      setMode('any');
      setTitleTemplate('');
      setDescription('');
      setHashtags('');
    }
  }, [existing, opened]);

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) {
      notifications.show({
        title: '請填名稱',
        message: '範本必須有名稱',
        color: 'mango'
      });
      return;
    }
    setBusy(true);
    try {
      const input: CreateTemplateInput = {
        name: name.trim(),
        mode,
        titleTemplate: titleTemplate.trim() || null,
        description: description.trim() || null,
        hashtags: hashtags.trim() || null
      };
      if (existing) {
        await window.puffin.templates.update({ id: existing.id, ...input });
      } else {
        await window.puffin.templates.create(input);
      }
      notifications.show({
        title: existing ? '已更新範本' : '已建立範本',
        message: name.trim(),
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      await onSaved();
    } catch (e) {
      notifications.show({
        title: '儲存失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={existing ? `編輯範本：${existing.name}` : '新增內文範本'}
      size="lg"
      centered
    >
      <Stack gap="md">
        <TextInput
          label="範本名稱"
          placeholder="例：勞資解析-專業款"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <Select
          label="適用模式"
          description="any = 任意模式都能套用；指定模式則只在該 mode 下顯示"
          data={[
            { value: 'any', label: '通用（任意模式）' },
            { value: 'video-reels', label: '影片 Reels' },
            { value: 'image-post', label: '單圖貼文' },
            { value: 'carousel', label: '多圖 Carousel' }
          ]}
          value={mode}
          onChange={(v) => setMode((v as TemplateMode) ?? 'any')}
        />

        <TextInput
          label="標題模板"
          description={<>支援變數 <Code>{'{filename}'}</Code>（自動去除前綴編號）。也可以留空，發布時手動填。</>}
          placeholder="【勞資領航者｜企業軍師 林郁汶】{filename}"
          value={titleTemplate}
          onChange={(e) => setTitleTemplate(e.currentTarget.value)}
        />

        <Textarea
          label="描述 / 內文"
          description="會貼到 YT 描述、FB 貼文內文、IG caption 主體"
          placeholder="想了解更多勞資知識嗎？歡迎追蹤「企業軍師 林郁汶」..."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={4}
          maxRows={8}
          autosize
        />

        <Textarea
          label="Hashtag"
          description="會附加到 caption 末尾（記得加 # 前綴）"
          placeholder="#勞資糾紛 #資遣費 #企業軍師 #林郁汶"
          value={hashtags}
          onChange={(e) => setHashtags(e.currentTarget.value)}
          minRows={2}
          maxRows={4}
          autosize
        />

        <Divider />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button color="mint" onClick={handleSave} loading={busy}>
            {existing ? '更新範本' : '建立範本'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
