import { useEffect, useState } from 'react';
import { Stack, Text, UnstyledButton, Group, Badge } from '@mantine/core';
import {
  IconSparkles,
  IconCalendarEvent,
  IconHistory,
  IconUserCircle,
  IconSettings,
  IconClipboardText,
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

export function Sidebar({ active, onChange }: SidebarProps) {
  // v0.9.8：版本號動態抓真實值（原本寫死 v0.1.0）
  const [version, setVersion] = useState<string>('');
  useEffect(() => {
    window.puffin.system.getVersion().then(setVersion).catch(() => {});
  }, []);

  return (
    <Stack gap={4} p="md" h="100%">
      {/* 品牌頭 */}
      <Group gap="xs" px="xs" mb="md">
        <Text size="xl" fw={800} c="walnut.8">
          🐧 海鸚泡芙
        </Text>
      </Group>
      <Badge variant="light" color="mint" size="sm" mx="xs" mb="sm">
        {version ? `v${version}` : '...'}
      </Badge>

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
