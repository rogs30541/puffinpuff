import { useEffect, useState } from 'react';
import { Stack, Text, UnstyledButton, Group, Badge, Button, Progress, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSparkles,
  IconCalendarEvent,
  IconHistory,
  IconUserCircle,
  IconSettings,
  IconClipboardText,
  IconRefresh,
  IconDownload,
  IconRocket,
  type Icon
} from '@tabler/icons-react';

export type PageKey = 'publish' | 'schedule' | 'history' | 'accounts' | 'templates' | 'settings';

interface NavItem {
  key: PageKey;
  label: string;
  icon: Icon;
  shortcut: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'publish', label: '發布', icon: IconSparkles, shortcut: 'Ctrl 1' },
  { key: 'schedule', label: '排程', icon: IconCalendarEvent, shortcut: 'Ctrl 2' },
  { key: 'history', label: '歷史', icon: IconHistory, shortcut: 'Ctrl 3' },
  { key: 'accounts', label: '帳號', icon: IconUserCircle, shortcut: 'Ctrl 4' },
  { key: 'templates', label: '範本', icon: IconClipboardText, shortcut: 'Ctrl 5' },
  { key: 'settings', label: '設定', icon: IconSettings, shortcut: 'Ctrl 6' }
];

interface SidebarProps {
  active: PageKey;
  onChange: (key: PageKey) => void;
}

type UpdateUiState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'latest' }
  | { phase: 'available'; latest: string }
  | { phase: 'downloading'; latest: string; percent: number }
  | { phase: 'ready'; latest: string };

export function Sidebar({ active, onChange }: SidebarProps) {
  // v0.9.8：版本號動態抓真實值（原本寫死 v0.1.0）
  const [version, setVersion] = useState<string>('');
  // v0.10.1：自動更新狀態機
  const [update, setUpdate] = useState<UpdateUiState>({ phase: 'idle' });

  useEffect(() => {
    window.puffin.system.getVersion().then(setVersion).catch(() => {});
  }, []);

  useEffect(() => {
    const offAvailable = window.puffin.updates.onAvailable((r) => {
      if (r.latestVersion) setUpdate({ phase: 'available', latest: r.latestVersion });
    });
    const offProgress = window.puffin.updates.onProgress((p) => {
      setUpdate((u) =>
        u.phase === 'downloading' || u.phase === 'available'
          ? { phase: 'downloading', latest: 'latest' in u ? u.latest : '', percent: p.percent }
          : u
      );
    });
    const offDone = window.puffin.updates.onDownloaded((i) => {
      setUpdate({ phase: 'ready', latest: i.version });
    });
    const offErr = window.puffin.updates.onError((e) => {
      notifications.show({ title: '更新失敗', message: e.message, color: 'red' });
      setUpdate({ phase: 'idle' });
    });
    return () => {
      offAvailable();
      offProgress();
      offDone();
      offErr();
    };
  }, []);

  const handleCheck = async (): Promise<void> => {
    setUpdate({ phase: 'checking' });
    const r = await window.puffin.updates.check();
    if (r.status === 'available' && r.latestVersion) {
      setUpdate({ phase: 'available', latest: r.latestVersion });
    } else if (r.status === 'latest') {
      setUpdate({ phase: 'latest' });
      notifications.show({ title: '已是最新版本', message: `v${r.currentVersion}`, color: 'mint' });
      setTimeout(() => setUpdate({ phase: 'idle' }), 3000);
    } else if (r.status === 'dev') {
      notifications.show({ title: '開發模式', message: '不檢查更新', color: 'gray' });
      setUpdate({ phase: 'idle' });
    } else {
      notifications.show({ title: '檢查更新失敗', message: r.message ?? '未知錯誤', color: 'red' });
      setUpdate({ phase: 'idle' });
    }
  };

  const handleDownload = async (): Promise<void> => {
    if (update.phase !== 'available') return;
    setUpdate({ phase: 'downloading', latest: update.latest, percent: 0 });
    try {
      await window.puffin.updates.download();
    } catch (e) {
      notifications.show({ title: '下載失敗', message: (e as Error).message, color: 'red' });
      setUpdate({ phase: 'available', latest: update.latest });
    }
  };

  return (
    <Stack gap={4} p="md" h="100%">
      {/* 品牌頭 */}
      <Group gap="xs" px="xs" mb="md">
        <Text size="xl" fw={800} c="walnut.8">
          🐧 海鸚泡芙
        </Text>
      </Group>
      <Group gap={6} mx="xs" mb="sm" wrap="nowrap">
        <Badge variant="light" color="mint" size="sm">
          {version ? `v${version}` : '...'}
        </Badge>
        {(update.phase === 'idle' || update.phase === 'checking' || update.phase === 'latest') && (
          <Tooltip label="檢查 GitHub 上有沒有新版本">
            <Button
              variant="subtle"
              color="gray"
              size="compact-xs"
              loading={update.phase === 'checking'}
              onClick={handleCheck}
              leftSection={<IconRefresh size={12} />}
            >
              檢查更新
            </Button>
          </Tooltip>
        )}
      </Group>
      {update.phase === 'available' && (
        <Button
          mx="xs"
          mb="sm"
          size="compact-sm"
          color="sunny"
          variant="light"
          onClick={handleDownload}
          leftSection={<IconDownload size={14} />}
        >
          下載新版 v{update.latest}
        </Button>
      )}
      {update.phase === 'downloading' && (
        <Stack gap={4} mx="xs" mb="sm">
          <Text size="xs" c="dimmed">下載 v{update.latest} 中… {update.percent}%</Text>
          <Progress value={update.percent} size="sm" color="mint" />
        </Stack>
      )}
      {update.phase === 'ready' && (
        <Button
          mx="xs"
          mb="sm"
          size="compact-sm"
          color="mint"
          onClick={() => window.puffin.updates.install()}
          leftSection={<IconRocket size={14} />}
        >
          重啟並安裝 v{update.latest}
        </Button>
      )}

      {/* 主導覽 */}
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <UnstyledButton
            key={item.key}
            onClick={() => onChange(item.key)}
            style={{
              padding: '10px 14px',
              borderRadius: 14,
              backgroundColor: isActive ? '#E2F5EC' : 'transparent',
              color: isActive ? '#2F6E58' : '#3F3A36',
              transition: 'background-color 150ms ease'
            }}
          >
            <Group gap="md" justify="space-between" wrap="nowrap" style={{ minWidth: 0 }}>
              <Group gap="md" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <Icon size={20} stroke={isActive ? 2.2 : 1.6} />
                <Text size="sm" fw={isActive ? 600 : 500} lineClamp={1}>
                  {item.label}
                </Text>
              </Group>
              <Text
                size="10px"
                c={isActive ? 'mint.7' : 'dimmed'}
                style={{
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  letterSpacing: 0.5,
                  opacity: 0.6,
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {item.shortcut}
              </Text>
            </Group>
          </UnstyledButton>
        );
      })}

      {/* 底部品牌標語 */}
      <Stack gap={2} mt="auto" px="xs" pb="sm">
        <Text size="xs" c="dimmed">
          發一次，到三家。
        </Text>
        <Text size="xs" c="dimmed">
          PuffinPuff
        </Text>
      </Stack>
    </Stack>
  );
}
