/**
 * v0.9.0：OAuth 憑證（自帶 App）設定卡片
 *
 * 讓使用者貼自己的 Google / Meta / Threads App credentials JSON，
 * 不再依賴開發者 bundle 的 secrets 檔案 → 開源商用版基礎。
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Group,
  Divider,
  Button,
  Badge,
  Alert,
  Textarea,
  Anchor,
  Code
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconKey,
  IconCheck,
  IconAlertTriangle,
  IconTrash,
  IconExternalLink
} from '@tabler/icons-react';
import type { CredentialProvider, CredentialStatus } from '../../../shared/types';

const PROVIDER_META: Record<
  CredentialProvider,
  { name: string; guideUrl: string; guide: string; placeholder: string }
> = {
  google: {
    name: 'Google（YouTube）',
    guideUrl: 'https://console.cloud.google.com/',
    guide:
      '1. Google Cloud Console → 建立專案 → 啟用 YouTube Data API v3\n' +
      '2. OAuth 同意畫面 → External → 加自己為測試使用者\n' +
      '3. 憑證 → 建立 OAuth client ID → 類型「電腦版應用程式」\n' +
      '4. 下載 JSON → 整份貼到下方',
    placeholder: '{"installed":{"client_id":"...","client_secret":"...","redirect_uris":["http://localhost"]}}'
  },
  meta: {
    name: 'Meta（Facebook / Instagram）',
    guideUrl: 'https://developers.facebook.com/apps/',
    guide:
      '1. Meta for Developers → Create App → 類型「Business」\n' +
      '2. 加入產品「Facebook Login for Business」→ 建 Configuration（勾 pages_show_list, pages_manage_posts, publish_video, instagram_basic, instagram_content_publish 等）\n' +
      '3. App settings → Basic → 抄 App ID / App Secret\n' +
      '4. 按下方格式貼入（api_version 建議 v21.0）',
    placeholder:
      '{"app_id":"...","app_secret":"...","config_id":"...","api_version":"v21.0","redirect_uri":"https://localhost/puffinpuff-callback","scopes":["pages_show_list","pages_read_engagement","pages_manage_posts","publish_video","instagram_basic","instagram_content_publish","business_management"]}'
  },
  threads: {
    name: 'Threads',
    guideUrl: 'https://developers.facebook.com/apps/',
    guide:
      '1. 同一個 Meta App → 加入使用案例「Threads API」\n' +
      '2. Threads 設定頁 → 抄 Threads App ID / Secret（與主 App 不同）\n' +
      '3. 設定 Redirect Callback URL（公開 HTTPS domain）\n' +
      '4. 按下方格式貼入',
    placeholder:
      '{"app_id":"...","app_secret":"...","api_version":"v1.0","redirect_uri":"https://yourdomain.com/threads-callback","scopes":["threads_basic","threads_content_publish"]}'
  }
};

function ProviderSection({
  status,
  onChanged
}: {
  status: CredentialStatus;
  onChanged: () => void;
}): JSX.Element {
  const meta = PROVIDER_META[status.provider];
  const [jsonText, setJsonText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSave = async (): Promise<void> => {
    setBusy(true);
    try {
      await window.puffin.credentials.save(status.provider, jsonText);
      setJsonText('');
      setShowForm(false);
      notifications.show({
        title: `已儲存 ${meta.name} 憑證`,
        message: '已用 Windows DPAPI 加密儲存於本機',
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      onChanged();
    } catch (e) {
      notifications.show({
        title: '儲存失敗',
        message: (e as Error).message,
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!confirm(`確定要刪除 ${meta.name} 的自訂憑證嗎？（若安裝檔內建憑證存在會退回使用內建）`)) return;
    setBusy(true);
    try {
      await window.puffin.credentials.delete(status.provider);
      notifications.show({ title: `已刪除 ${meta.name} 自訂憑證`, message: '', color: 'mint' });
      onChanged();
    } catch (e) {
      notifications.show({ title: '刪除失敗', message: (e as Error).message, color: 'red' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Text size="sm" fw={600} c="walnut.7">{meta.name}</Text>
          {status.configured ? (
            <Badge color="mint" variant="light" size="xs">
              已設定（{status.source === 'db' ? '使用者提供' : '內建檔案'}）
            </Badge>
          ) : (
            <Badge color="red" variant="light" size="xs">未設定</Badge>
          )}
          {status.summary && (
            <Text size="xs" c="dimmed">{status.summary}</Text>
          )}
        </Group>
        <Group gap="xs">
          <Button variant="light" color="sky" size="xs" onClick={() => setShowForm((v) => !v)}>
            {showForm ? '收合' : status.configured ? '更換憑證' : '設定憑證'}
          </Button>
          {status.source === 'db' && (
            <Button
              variant="subtle"
              color="red"
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={handleDelete}
              disabled={busy}
            >
              刪除
            </Button>
          )}
        </Group>
      </Group>

      {showForm && (
        <>
          <Alert color="sky" variant="light" radius="md">
            <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>{meta.guide}</Text>
            <Anchor size="xs" href={meta.guideUrl} target="_blank" c="sky">
              開啟申請頁面 <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
            </Anchor>
          </Alert>
          <Textarea
            placeholder={meta.placeholder}
            value={jsonText}
            onChange={(e) => setJsonText(e.currentTarget.value)}
            autosize
            minRows={4}
            maxRows={10}
            styles={{ input: { fontFamily: 'monospace', fontSize: 12 } }}
          />
          <Group>
            <Button
              color="mint"
              size="xs"
              onClick={handleSave}
              loading={busy}
              disabled={!jsonText.trim()}
            >
              儲存憑證（DPAPI 加密）
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}

export function CredentialsCard(): JSX.Element {
  const [statuses, setStatuses] = useState<CredentialStatus[]>([]);

  const reload = useCallback(async () => {
    try {
      const s = await window.puffin.credentials.getStatus();
      setStatuses(s);
    } catch (e) {
      console.error('[credentials] getStatus failed:', e);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <Card>
      <Stack gap="md">
        <Group gap="sm">
          <IconKey size={20} color="#6FBF9D" />
          <Title order={4} c="walnut.7">OAuth 憑證（自帶 App）</Title>
        </Group>
        <Divider />
        <Text size="xs" c="dimmed">
          PuffinPuff 需要你自己的 Google / Meta App 才能連接平台帳號。
          安裝檔若已內建憑證（顯示「內建檔案」）可直接使用；開源自建版請在此貼入自己的 App credentials。
          所有憑證用 Windows DPAPI 加密儲存於<Code>本機</Code>，不會上傳到任何伺服器。
        </Text>
        {statuses.map((s) => (
          <div key={s.provider}>
            <ProviderSection status={s} onChanged={reload} />
            <Divider variant="dashed" mt="sm" />
          </div>
        ))}
      </Stack>
    </Card>
  );
}
