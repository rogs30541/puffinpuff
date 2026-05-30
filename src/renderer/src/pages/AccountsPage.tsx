import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Badge,
  Group,
  SimpleGrid,
  Button,
  Avatar,
  Loader,
  Tooltip,
  Alert
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBrandYoutube,
  IconBrandFacebook,
  IconBrandInstagram,
  IconLink,
  IconLinkOff,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  type Icon
} from '@tabler/icons-react';
import type { AccountPublic, Platform } from '../../../shared/types';

interface PlatformDef {
  platform: Platform;
  icon: Icon;
  name: string;
  description: string;
  color: string;
  connectKind: 'google' | 'meta' | 'none';
}

const PLATFORMS: PlatformDef[] = [
  {
    platform: 'youtube',
    icon: IconBrandYoutube,
    name: 'YouTube',
    description: '上傳 Shorts 到你的頻道。Google 帳號 OAuth。',
    color: '#FF0000',
    connectKind: 'google'
  },
  {
    platform: 'facebook',
    icon: IconBrandFacebook,
    name: 'Facebook',
    description: '發布 Reels 與貼文到粉絲專頁。Meta Business Login。',
    color: '#1877F2',
    connectKind: 'meta'
  },
  {
    platform: 'instagram',
    icon: IconBrandInstagram,
    name: 'Instagram',
    description: '發布 Reels 與貼文。透過 FB 粉專連動，與 Facebook 共用一次授權。',
    color: '#E4405F',
    connectKind: 'meta'
  }
];

interface PlatformCardProps {
  def: PlatformDef;
  accounts: AccountPublic[];
  onConnect: () => void;
  onDisconnect: (id: number) => void;
  onTestConnection: (id: number) => void;
  onDebugMetaToken: (id: number) => void;
  testingId: number | null;
  isConnecting: boolean;
}

function PlatformCard({
  def,
  accounts,
  onConnect,
  onDisconnect,
  onTestConnection,
  onDebugMetaToken,
  testingId,
  isConnecting
}: PlatformCardProps) {
  const { icon: Icon } = def;
  const hasAccount = accounts.length > 0;

  return (
    <Card>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <Icon size={28} color={def.color} />
            <Title order={4}>{def.name}</Title>
          </Group>
          {hasAccount ? (
            <Badge color="mint" variant="light" size="sm" leftSection={<IconCheck size={12} />}>
              已連線 {accounts.length > 1 ? `×${accounts.length}` : ''}
            </Badge>
          ) : (
            <Badge color="walnut" variant="light" size="sm">未連線</Badge>
          )}
        </Group>

        {!hasAccount && (
          <Text size="sm" c="dimmed">{def.description}</Text>
        )}

        {accounts.map((acct) => (
          <Group key={acct.id} justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <Avatar
                src={(acct.metadata?.thumbnail as string | null) ?? null}
                radius="xl"
                size="md"
              >
                {acct.displayName[0]}
              </Avatar>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text size="sm" fw={600} lineClamp={1}>{acct.displayName}</Text>
                <Text size="xs" c="dimmed" lineClamp={1}>ID: {acct.externalId}</Text>
              </div>
            </Group>
            <Group gap={4}>
              <Tooltip label="測試連線（Call API 確認 token 還活著）">
                <Button
                  variant="subtle"
                  color="mint"
                  size="xs"
                  loading={testingId === acct.id}
                  onClick={() => onTestConnection(acct.id)}
                >
                  🔍 測試
                </Button>
              </Tooltip>
              {(acct.platform === 'facebook' || acct.platform === 'instagram') && (
                <Tooltip label="v0.6.8：查看 token 實際拿到哪些 scopes（debug_token）">
                  <Button
                    variant="subtle"
                    color="lavender"
                    size="xs"
                    onClick={() => onDebugMetaToken(acct.id)}
                  >
                    🔬 Scope
                  </Button>
                </Tooltip>
              )}
              <Tooltip label="解除連線">
                <Button
                  variant="subtle"
                  color="walnut"
                  size="xs"
                  onClick={() => onDisconnect(acct.id)}
                  leftSection={<IconLinkOff size={14} />}
                >
                  解綁
                </Button>
              </Tooltip>
            </Group>
          </Group>
        ))}

        <Button
          leftSection={isConnecting ? <Loader size={14} color="white" /> : <IconLink size={16} />}
          variant={hasAccount ? 'light' : 'filled'}
          color="mint"
          onClick={onConnect}
          disabled={isConnecting}
        >
          {isConnecting
            ? '授權中…請完成授權視窗內步驟'
            : hasAccount
              ? '加入另一個帳號'
              : '連線'}
        </Button>
      </Stack>
    </Card>
  );
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [connecting, setConnecting] = useState<'google' | 'meta' | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await window.puffin.accounts.list();
      setAccounts(list);
    } catch (e) {
      console.error('list accounts failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleConnectGoogle = async () => {
    setConnecting('google');
    try {
      const account = await window.puffin.accounts.connectGoogle();
      notifications.show({
        title: '已連線 YouTube',
        message: `${account.displayName} 已成功授權`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      await refresh();
    } catch (e) {
      notifications.show({
        title: 'YouTube 連線失敗',
        message: (e as Error).message,
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleConnectMeta = async () => {
    setConnecting('meta');
    try {
      const result = await window.puffin.accounts.connectMeta();
      const fbCount = result.facebookAccounts.length;
      const igCount = result.instagramAccounts.length;
      const parts: string[] = [];
      if (fbCount > 0) parts.push(`${fbCount} 個 FB 粉專`);
      if (igCount > 0) parts.push(`${igCount} 個 IG 帳號`);
      notifications.show({
        title: '已連線 Meta',
        message: parts.length
          ? `${result.user.name}：${parts.join('、')}`
          : `${result.user.name} 已授權，但未找到可發布的資產`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      await refresh();
    } catch (e) {
      notifications.show({
        title: 'Meta 連線失敗',
        message: (e as Error).message,
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: number) => {
    try {
      await window.puffin.accounts.disconnect(id);
      notifications.show({
        title: '已解除連線',
        message: '帳號授權已移除',
        color: 'mint'
      });
      await refresh();
    } catch (e) {
      notifications.show({
        title: '解除失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  // v0.4.4：測試連線
  const handleDebugMetaToken = async (id: number) => {
    try {
      const result = await window.puffin.accounts.debugMetaToken(id);
      if (result.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (result.data as any)?.data ?? {};
        const scopes: string[] = data.scopes ?? [];
        const expiresAt = data.expires_at ? new Date(data.expires_at * 1000).toLocaleString('zh-TW') : '未知';
        const isValid = data.is_valid ?? '?';
        const appId = data.app_id ?? '?';
        const profile = data.profile_id ?? data.user_id ?? '?';
        notifications.show({
          title: '✓ Token 診斷成功',
          message: `App=${appId} 有效=${isValid} 過期=${expiresAt}\n\nScopes (${scopes.length})：\n${scopes.join(', ')}\n\nProfile：${profile}\n\n(完整 response 已印到 main process console)`,
          color: 'lavender',
          autoClose: 30_000,
          icon: <IconCheck size={18} />
        });
      } else {
        notifications.show({
          title: 'Token 診斷失敗',
          message: result.message,
          color: 'red',
          autoClose: 15_000
        });
      }
    } catch (e) {
      notifications.show({
        title: 'Debug 失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    try {
      const result = await window.puffin.accounts.testConnection(id);
      notifications.show({
        title: result.ok ? '✓ 連線正常' : '✕ 連線失敗',
        message: `${result.message}（${result.latencyMs}ms）`,
        color: result.ok ? 'mint' : 'red',
        icon: result.ok ? <IconCheck size={18} /> : <IconAlertTriangle size={18} />,
        autoClose: result.ok ? 4000 : 10000
      });
    } catch (e) {
      notifications.show({
        title: '測試失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Stack gap="lg" py="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} c="walnut.8">帳號</Title>
          <Text c="dimmed" size="sm" mt={4}>
            授權平台後，海鸚才能替你飛行。
          </Text>
        </div>
        {loading && <Loader size="sm" color="mint" />}
      </Group>

      <Alert
        icon={<IconInfoCircle size={18} />}
        color="sky"
        variant="light"
        radius="lg"
        title="一次授權，FB + IG 雙開"
      >
        Facebook 與 Instagram 共用 Meta Business Login —— 點任一卡片的「連線」按鈕，會同時把你管理的所有粉專與連動的 IG Business 帳號接進來。
      </Alert>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
        {PLATFORMS.map((def) => {
          const platformAccounts = accounts.filter((a) => a.platform === def.platform);
          const onConnect =
            def.connectKind === 'google'
              ? handleConnectGoogle
              : def.connectKind === 'meta'
                ? handleConnectMeta
                : () => {};
          const isConnecting =
            (def.connectKind === 'google' && connecting === 'google') ||
            (def.connectKind === 'meta' && connecting === 'meta');
          return (
            <PlatformCard
              key={def.platform}
              def={def}
              accounts={platformAccounts}
              onConnect={onConnect}
              onDisconnect={handleDisconnect}
              onTestConnection={handleTestConnection}
              onDebugMetaToken={handleDebugMetaToken}
              testingId={testingId}
              isConnecting={isConnecting}
            />
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
