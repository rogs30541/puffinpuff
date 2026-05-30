/**
 * v0.4.1：監聽資料夾管理 Modal
 * 顯示所有監聽中的資料夾、可新增/編輯/刪除/開關
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Card,
  Text,
  Badge,
  Button,
  Switch,
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  Divider,
  ActionIcon,
  Alert
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconFolder,
  IconPlus,
  IconTrash,
  IconEdit,
  IconBrandYoutube,
  IconBrandFacebook,
  IconBrandInstagram,
  IconCheck,
  IconAlertTriangle,
  IconFolderOpen,
  IconEye
} from '@tabler/icons-react';
import {
  BRAND_DEFAULTS,
  type AccountPublic,
  type WatchedFolder,
  type WatcherTemplate
} from '../../../shared/types';

interface Props {
  opened: boolean;
  onClose: () => void;
}

interface EditState {
  id: number | null;
  folderPath: string;
  label: string;
  intervalHours: number;
  nextScheduleAt: Date;
  template: WatcherTemplate;
}

function newEditState(): EditState {
  const t = new Date();
  t.setHours(t.getHours() + 1, 0, 0, 0); // 預設下個整點
  return {
    id: null,
    folderPath: '',
    label: '',
    intervalHours: 24,
    nextScheduleAt: t,
    template: {
      titleTemplate: BRAND_DEFAULTS.titleTemplate,
      description: '',
      hashtags: BRAND_DEFAULTS.hashtags,
      privacy: 'public',
      platforms: ['youtube', 'facebook', 'instagram']
    }
  };
}

export function WatchersModal({ opened, onClose }: Props) {
  const [watchers, setWatchers] = useState<WatchedFolder[]>([]);
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    try {
      const [w, a] = await Promise.all([
        window.puffin.watchers.list(),
        window.puffin.accounts.list()
      ]);
      setWatchers(w);
      setAccounts(a);
    } catch (e) {
      console.error('load watchers failed', e);
    }
  };

  useEffect(() => {
    if (opened) {
      refresh();
    }
  }, [opened]);

  const ytAccounts = useMemo(() => accounts.filter((a) => a.platform === 'youtube'), [accounts]);
  const fbAccounts = useMemo(() => accounts.filter((a) => a.platform === 'facebook'), [accounts]);
  const igAccounts = useMemo(() => accounts.filter((a) => a.platform === 'instagram'), [accounts]);

  const handleAdd = () => {
    const s = newEditState();
    // 自動帶第一個帳號
    const firstYT = ytAccounts[0];
    const firstFB = fbAccounts[0];
    const firstIG = igAccounts[0];
    s.template.targetAccounts = {
      ...(firstYT ? { youtube: firstYT.id } : {}),
      ...(firstFB ? { facebook: firstFB.id } : {}),
      ...(firstIG ? { instagram: firstIG.id } : {})
    };
    setEditing(s);
  };

  const handleEdit = (w: WatchedFolder) => {
    setEditing({
      id: w.id,
      folderPath: w.folderPath,
      label: w.label ?? '',
      intervalHours: w.intervalHours,
      nextScheduleAt: new Date(w.nextScheduleAt),
      template: { ...w.template }
    });
  };

  const handlePickFolder = async () => {
    const path = await window.puffin.watchers.pickFolder();
    if (path && editing) {
      setEditing({ ...editing, folderPath: path });
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.folderPath) {
      notifications.show({ title: '請選資料夾', message: '', color: 'red' });
      return;
    }
    if (editing.template.platforms.length === 0) {
      notifications.show({ title: '請至少選一個平台', message: '', color: 'red' });
      return;
    }
    setSaving(true);
    try {
      if (editing.id === null) {
        await window.puffin.watchers.create({
          folderPath: editing.folderPath,
          label: editing.label || null,
          template: editing.template,
          nextScheduleAt: editing.nextScheduleAt.getTime(),
          intervalHours: editing.intervalHours
        });
        notifications.show({
          title: '已建立監聽',
          message: `現在 PuffinPuff 會自動處理「${editing.folderPath}」內的新影片`,
          color: 'mint',
          icon: <IconCheck size={18} />
        });
      } else {
        await window.puffin.watchers.update({
          id: editing.id,
          label: editing.label || null,
          template: editing.template,
          nextScheduleAt: editing.nextScheduleAt.getTime(),
          intervalHours: editing.intervalHours
        });
        notifications.show({
          title: '已更新監聽設定',
          message: '',
          color: 'mint',
          icon: <IconCheck size={18} />
        });
      }
      setEditing(null);
      await refresh();
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

  const handleToggleEnabled = async (w: WatchedFolder, enabled: boolean) => {
    try {
      await window.puffin.watchers.update({ id: w.id, enabled });
      await refresh();
    } catch (e) {
      notifications.show({ title: '切換失敗', message: (e as Error).message, color: 'red' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('確定要刪除此監聽嗎？已排程的貼文不會被刪除。')) return;
    try {
      await window.puffin.watchers.delete(id);
      notifications.show({ title: '已刪除', message: '', color: 'mint' });
      await refresh();
    } catch (e) {
      notifications.show({ title: '刪除失敗', message: (e as Error).message, color: 'red' });
    }
  };

  const togglePlatform = (p: 'youtube' | 'facebook' | 'instagram') => {
    if (!editing) return;
    const current = editing.template.platforms;
    const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
    setEditing({
      ...editing,
      template: { ...editing.template, platforms: next }
    });
  };

  const platformMeta = {
    youtube: { icon: IconBrandYoutube, color: '#FF0000', name: 'YouTube' },
    facebook: { icon: IconBrandFacebook, color: '#1877F2', name: 'Facebook' },
    instagram: { icon: IconBrandInstagram, color: '#E4405F', name: 'Instagram' }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        setEditing(null);
        onClose();
      }}
      title="📂 監聽資料夾自動排程"
      size="92%"
      radius="xl"
    >
      <Stack gap="md">
        {!editing && (
          <>
            <Alert color="sky" variant="light" icon={<IconEye size={18} />}>
              <Text size="sm">
                把要發布的影片直接丟到監聽資料夾，PuffinPuff 會自動套模板排程，並把處理過的檔案移到「_processed」子資料夾。
                適合代操客戶 / NAS 共用資料夾 / 工作室自動化流程。
              </Text>
            </Alert>

            <Group justify="space-between">
              <Text fw={600}>目前 {watchers.length} 個監聽中</Text>
              <Button color="mint" leftSection={<IconPlus size={16} />} onClick={handleAdd}>
                新增監聽
              </Button>
            </Group>

            <Stack gap="sm">
              {watchers.length === 0 && (
                <Card padding="lg" style={{ textAlign: 'center', backgroundColor: '#FBF7F2' }}>
                  <IconFolder size={48} color="#D2CCC4" stroke={1.5} style={{ margin: '0 auto' }} />
                  <Text c="dimmed" mt="sm">尚未設定任何監聽資料夾</Text>
                  <Text size="xs" c="dimmed">點上方「新增監聽」開始</Text>
                </Card>
              )}
              {watchers.map((w) => (
                <Card key={w.id} padding="md" withBorder>
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Group gap="xs">
                        <IconFolder size={16} color={w.enabled ? '#6FBF9D' : '#B3ABA0'} />
                        <Text fw={600} size="sm">{w.label || w.folderPath.split(/[\\/]/).pop()}</Text>
                        <Badge size="xs" color={w.enabled ? 'mint' : 'walnut'} variant="light">
                          {w.enabled ? '啟用中' : '已停用'}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                        {w.folderPath}
                      </Text>
                      <Group gap="xs" mt={4}>
                        {w.template.platforms.map((p) => {
                          const meta = platformMeta[p];
                          const Icon = meta.icon;
                          return <Icon key={p} size={14} color={meta.color} />;
                        })}
                        <Text size="xs" c="dimmed">
                          每 {w.intervalHours}h 發 1 篇 · 下次：{new Date(w.nextScheduleAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </Group>
                      {w.lastError && (
                        <Text size="xs" c="red" mt={2}>⚠ 上次錯誤：{w.lastError}</Text>
                      )}
                    </Stack>
                    <Group gap={4}>
                      <Switch
                        checked={w.enabled}
                        onChange={(e) => handleToggleEnabled(w, e.currentTarget.checked)}
                        color="mint"
                        size="sm"
                      />
                      <ActionIcon variant="subtle" color="walnut" onClick={() => handleEdit(w)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(w.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Card>
              ))}
            </Stack>
          </>
        )}

        {editing && (
          <Stack gap="md">
            <Text fw={700} c="walnut.8">
              {editing.id === null ? '新增監聽資料夾' : '編輯監聽設定'}
            </Text>

            <Group grow>
              <TextInput
                label="資料夾路徑"
                value={editing.folderPath}
                onChange={(e) => setEditing({ ...editing, folderPath: e.currentTarget.value })}
                placeholder="C:\Users\... 或 D:\..."
                rightSection={
                  <ActionIcon variant="light" color="mint" onClick={handlePickFolder}>
                    <IconFolderOpen size={16} />
                  </ActionIcon>
                }
              />
              <TextInput
                label="標籤（顯示用）"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.currentTarget.value })}
                placeholder="客戶 A 短影音"
              />
            </Group>

            <Group grow>
              <DateTimePicker
                label="第 1 篇排到何時"
                value={editing.nextScheduleAt}
                onChange={(v) => v && setEditing({ ...editing, nextScheduleAt: new Date(v as unknown as string | Date) })}
                minDate={new Date()}
                radius="md"
              />
              <NumberInput
                label="間隔（小時）"
                description="例：24 = 每天 1 篇；6 = 每 6 小時 1 篇"
                value={editing.intervalHours}
                onChange={(v) => setEditing({ ...editing, intervalHours: typeof v === 'number' && v > 0 ? v : 24 })}
                min={0.5}
                max={720}
                step={1}
                radius="md"
              />
            </Group>

            <Divider />

            <TextInput
              label="標題模板"
              description="用 {檔名} 表示要插入影片檔名（自動去副檔名）"
              value={editing.template.titleTemplate}
              onChange={(e) => setEditing({
                ...editing,
                template: { ...editing.template, titleTemplate: e.currentTarget.value }
              })}
            />

            <TextInput
              label="共通 Hashtag"
              value={editing.template.hashtags}
              onChange={(e) => setEditing({
                ...editing,
                template: { ...editing.template, hashtags: e.currentTarget.value }
              })}
            />

            <div>
              <Text size="sm" mb={6} fw={600}>發布平台</Text>
              <Group gap="sm">
                {(['youtube', 'facebook', 'instagram'] as const).map((p) => {
                  const meta = platformMeta[p];
                  const Icon = meta.icon;
                  return (
                    <Checkbox
                      key={p}
                      checked={editing.template.platforms.includes(p)}
                      onChange={() => togglePlatform(p)}
                      color="mint"
                      label={
                        <Group gap={4} wrap="nowrap">
                          <Icon size={16} color={meta.color} />
                          <Text size="sm">{meta.name}</Text>
                        </Group>
                      }
                    />
                  );
                })}
              </Group>
            </div>

            <Text size="sm" fw={600}>目標帳號</Text>
            <Stack gap="xs">
              {editing.template.platforms.includes('youtube') && (
                <Select
                  label={<Group gap={4}><IconBrandYoutube size={14} color="#FF0000" /><Text size="xs">YouTube 頻道</Text></Group>}
                  value={editing.template.targetAccounts?.youtube ? String(editing.template.targetAccounts.youtube) : null}
                  onChange={(v) => setEditing({
                    ...editing,
                    template: {
                      ...editing.template,
                      targetAccounts: {
                        ...editing.template.targetAccounts,
                        youtube: v ? parseInt(v, 10) : undefined
                      }
                    }
                  })}
                  data={ytAccounts.map((a) => ({ value: String(a.id), label: a.displayName }))}
                  disabled={ytAccounts.length === 0}
                  placeholder={ytAccounts.length === 0 ? '請先連結 YouTube' : '選擇頻道'}
                  radius="md"
                  size="xs"
                />
              )}
              {editing.template.platforms.includes('facebook') && (
                <Select
                  label={<Group gap={4}><IconBrandFacebook size={14} color="#1877F2" /><Text size="xs">Facebook 粉專</Text></Group>}
                  value={editing.template.targetAccounts?.facebook ? String(editing.template.targetAccounts.facebook) : null}
                  onChange={(v) => setEditing({
                    ...editing,
                    template: {
                      ...editing.template,
                      targetAccounts: {
                        ...editing.template.targetAccounts,
                        facebook: v ? parseInt(v, 10) : undefined
                      }
                    }
                  })}
                  data={fbAccounts.map((a) => ({ value: String(a.id), label: a.displayName }))}
                  disabled={fbAccounts.length === 0}
                  placeholder={fbAccounts.length === 0 ? '請先連結 Facebook' : '選擇粉專'}
                  radius="md"
                  size="xs"
                />
              )}
              {editing.template.platforms.includes('instagram') && (
                <Select
                  label={<Group gap={4}><IconBrandInstagram size={14} color="#E4405F" /><Text size="xs">Instagram 帳號</Text></Group>}
                  value={editing.template.targetAccounts?.instagram ? String(editing.template.targetAccounts.instagram) : null}
                  onChange={(v) => setEditing({
                    ...editing,
                    template: {
                      ...editing.template,
                      targetAccounts: {
                        ...editing.template.targetAccounts,
                        instagram: v ? parseInt(v, 10) : undefined
                      }
                    }
                  })}
                  data={igAccounts.map((a) => ({ value: String(a.id), label: a.displayName }))}
                  disabled={igAccounts.length === 0}
                  placeholder={igAccounts.length === 0 ? '請先連結 Instagram' : '選擇 IG'}
                  radius="md"
                  size="xs"
                />
              )}
            </Stack>

            <Alert color="mango" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="xs">
                提示：新檔放進資料夾後，PuffinPuff 會等 5 秒（避免抓到複製中的檔案），然後自動排程並把原檔移到「_processed/yyyy-mm/」子資料夾。
                影片仍在原資料夾的「_processed」內，方便日後對帳。
              </Text>
            </Alert>

            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" color="walnut" onClick={() => setEditing(null)}>取消</Button>
              <Button color="mint" onClick={handleSave} loading={saving} leftSection={<IconCheck size={16} />}>
                {editing.id === null ? '建立監聽' : '儲存'}
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
