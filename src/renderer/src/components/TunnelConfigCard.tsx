/**
 * v0.5.0：IG 隧道工具設定卡片
 *
 * 兩個模式：
 *   - quick (預設)：cloudflared quick tunnel，無需設定，但 Cloudflare 對 IP 限流（error 1015）
 *   - named-cloudflare：Cloudflare named tunnel，需 Cloudflare 帳號 + tunnel token + hostname，
 *                       無 IP 限流，永久穩定
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
  Radio,
  TextInput,
  PasswordInput,
  Badge,
  Alert,
  Code,
  Anchor
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconTransform,
  IconCheck,
  IconAlertTriangle,
  IconRocket,
  IconTrash,
  IconRefresh,
  IconExternalLink
} from '@tabler/icons-react';
import type { TunnelMode, TunnelNamedConfigPublic } from '../../../shared/types';

export function TunnelConfigCard(): JSX.Element {
  const [mode, setMode] = useState<TunnelMode>('quick');
  const [config, setConfig] = useState<TunnelNamedConfigPublic | null>(null);
  const [token, setToken] = useState('');
  const [hostname, setHostname] = useState('');
  const [localPort, setLocalPort] = useState(33344);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [redownloadingCf, setRedownloadingCf] = useState(false);

  const reload = useCallback(async () => {
    const [m, c, p] = await Promise.all([
      window.puffin.tunnel.getMode(),
      window.puffin.tunnel.getNamedConfig(),
      window.puffin.tunnel.getNamedLocalPort()
    ]);
    setMode(m);
    setConfig(c);
    setLocalPort(p);
    if (c) {
      setHostname(c.publicHostname);
      // token 不會回傳明文（保密），保留輸入框空白
      setToken('');
    } else {
      setHostname('');
      setToken('');
    }
  }, []);

  useEffect(() => {
    reload().catch((e) => console.error('[tunnel] reload failed:', e));
  }, [reload]);

  const handleModeChange = async (newMode: TunnelMode): Promise<void> => {
    if (newMode === 'named-cloudflare' && !config) {
      notifications.show({
        title: '請先儲存 Named Tunnel 設定',
        message: '輸入 token + hostname 並儲存後，才能切換到 Named Tunnel 模式',
        color: 'mango',
        icon: <IconAlertTriangle size={18} />
      });
      return;
    }
    setBusy(true);
    try {
      await window.puffin.tunnel.setMode(newMode);
      setMode(newMode);
      notifications.show({
        title: '已切換 IG 隧道模式',
        message: newMode === 'named-cloudflare' ? '改用 Cloudflare Named Tunnel（無 IP 限流）' : '改用 Quick Tunnel（無帳號 ad-hoc 隧道）',
        color: 'mint',
        icon: <IconCheck size={18} />
      });
    } catch (e) {
      notifications.show({
        title: '切換失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!token.trim()) {
      notifications.show({
        title: 'Token 為空',
        message: '請貼上從 Cloudflare dashboard 複製的 tunnel token',
        color: 'mango'
      });
      return;
    }
    if (!hostname.trim()) {
      notifications.show({
        title: 'Hostname 為空',
        message: '請填入 Public Hostname（例 puffin.mememaker-tw.com）',
        color: 'mango'
      });
      return;
    }
    setBusy(true);
    try {
      const c = await window.puffin.tunnel.saveNamedConfig({
        token: token.trim(),
        publicHostname: hostname.trim()
      });
      setConfig(c);
      // v0.5.2：不清空 token state（PasswordInput 顯示為點點，本來就不會洩漏）
      // 這樣使用者可以接著按「測試連線」不用重新貼一次
      setTestResult(null);
      notifications.show({
        title: '已儲存 Named Tunnel 設定',
        message: 'Token 已用 Windows DPAPI 加密儲存。可直接按「測試連線」驗證',
        color: 'mint',
        icon: <IconCheck size={18} />
      });
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

  const handleTest = async (): Promise<void> => {
    // v0.5.2：input 空 → backend 會 fallback 用 DB 加密 token；只需有 config 或新貼 token 其一即可測試
    const effectiveToken = token.trim();
    const effectiveHostname = hostname.trim() || config?.publicHostname || '';
    if (!effectiveHostname) {
      notifications.show({
        title: 'Hostname 為空',
        message: '請填入 Public Hostname 後再測試',
        color: 'mango'
      });
      return;
    }
    if (!effectiveToken && !config) {
      notifications.show({
        title: 'Token 為空',
        message: '請貼上 token 後再測試（首次使用尚未儲存任何 token）',
        color: 'mango'
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // v0.5.2：effectiveToken 為空時 backend 會用 DB 儲存的 token（已加密儲存，後端解密用）
      const r = await window.puffin.tunnel.testNamed({
        token: effectiveToken, // 可能為 ''，backend 會 fallback
        publicHostname: effectiveHostname
      });
      setTestResult(r);
      // reload config 取得最新的 lastVerifiedAt
      const c = await window.puffin.tunnel.getNamedConfig();
      setConfig(c);
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!confirm('確定要刪除 Named Tunnel 設定嗎？（會自動切回 Quick Tunnel 模式）')) return;
    setBusy(true);
    try {
      await window.puffin.tunnel.deleteNamedConfig();
      // 若當前是 named 模式 → 自動切回 quick
      if (mode === 'named-cloudflare') {
        await window.puffin.tunnel.setMode('quick');
        setMode('quick');
      }
      setConfig(null);
      setToken('');
      setHostname('');
      setTestResult(null);
      notifications.show({
        title: '已刪除 Named Tunnel 設定',
        message: 'IG 隧道模式已切回 Quick Tunnel',
        color: 'mint',
        icon: <IconCheck size={18} />
      });
    } catch (e) {
      notifications.show({
        title: '刪除失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRedownloadCf = async (): Promise<void> => {
    setRedownloadingCf(true);
    try {
      const r = await window.puffin.system.redownloadCloudflared();
      if (r.ok) {
        const mb = r.bytes ? (r.bytes / 1024 / 1024).toFixed(1) : '?';
        notifications.show({
          title: 'cloudflared 已重新下載',
          message: `下載成功（${mb} MB）`,
          color: 'mint',
          icon: <IconCheck size={18} />
        });
      } else {
        notifications.show({
          title: '重新下載失敗',
          message: r.error ?? '未知錯誤',
          color: 'red'
        });
      }
    } finally {
      setRedownloadingCf(false);
    }
  };

  return (
    <Card>
      <Stack gap="md">
        <Group gap="sm">
          <IconTransform size={20} color="#6FBF9D" />
          <Title order={4} c="walnut.7">IG 隧道工具（cloudflared）</Title>
        </Group>
        <Divider />

        <Text size="xs" c="dimmed">
          IG Reels / 圖片上傳時，PuffinPuff 會起本機 HTTP server + cloudflared 隧道把檔案暴露成公開 HTTPS URL 供 Instagram 取用。
        </Text>

        {/* === 模式選擇 === */}
        <Radio.Group
          value={mode}
          onChange={(v) => handleModeChange(v as TunnelMode)}
          label="IG 隧道模式"
        >
          <Stack gap="xs" mt="xs">
            <Radio
              value="quick"
              label={
                <Stack gap={0}>
                  <Text size="sm" fw={600}>Quick Tunnel（預設、零設定）</Text>
                  <Text size="xs" c="dimmed">
                    每次發布隨機開一條 trycloudflare.com URL。零設定但 Cloudflare 對 IP 有限流（error 1015）。適合偶爾發布。
                  </Text>
                </Stack>
              }
              color="mint"
            />
            <Radio
              value="named-cloudflare"
              disabled={!config}
              label={
                <Stack gap={0}>
                  <Group gap="xs">
                    <Text size="sm" fw={600}>Named Tunnel（穩定、無限流）</Text>
                    {config && (
                      <Badge color="mint" variant="light" size="xs">
                        已設定
                      </Badge>
                    )}
                    {!config && (
                      <Badge color="dimmed" variant="light" size="xs">
                        未設定（先填下方表單）
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    用你 Cloudflare 帳號下的 named tunnel，固定 hostname、無 IP 限流。適合密集發布（每天 N 篇）。
                  </Text>
                </Stack>
              }
              color="mint"
            />
          </Stack>
        </Radio.Group>

        <Divider variant="dashed" />

        {/* === Named Tunnel 設定區 === */}
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={600} c="walnut.7">
              Named Tunnel 設定
            </Text>
            <Anchor
              size="xs"
              href="https://one.dash.cloudflare.com/"
              target="_blank"
              c="sky"
            >
              開啟 Cloudflare Zero Trust dashboard <IconExternalLink size={12} style={{ verticalAlign: 'middle' }} />
            </Anchor>
          </Group>

          <Alert color="sky" variant="light" radius="md" icon={<IconRocket size={18} />}>
            <Text size="xs">
              <strong>一次性設定流程（~10 分鐘）：</strong>
              <br />
              1. 開啟 Cloudflare Zero Trust → Networks → Tunnels → <strong>Create a tunnel</strong>
              <br />
              2. Connector type 選 <Code>Cloudflared</Code>，Tunnel name 命名（例 <Code>puffinpuff</Code>）
              <br />
              3. <strong>複製畫面上的 token</strong>（以 <Code>eyJ...</Code> 開頭）→ 貼到下方
              <br />
              4. 跳過 Windows 安裝指令 → 下一頁 <strong>Public Hostname</strong>：
              <br />
              　　<strong>Service Type：HTTP，URL：</strong><Code>localhost:{localPort}</Code> （必須是這個 port！）
              <br />
              　　<strong>Subdomain + Domain</strong>：例 <Code>puffin.mememaker-tw.com</Code>
              <br />
              5. 儲存 → 回到這裡填 token + hostname → 「儲存設定」→「測試連線」
            </Text>
          </Alert>

          <PasswordInput
            label="Cloudflare Tunnel Token"
            description={
              config
                ? 'Token 已加密儲存（DPAPI）。測試 / 換 hostname 不需重貼；要換 token 才需重新貼上完整 token。'
                : '從 Cloudflare dashboard 複製貼上（一般以 eyJ... 開頭，數百字元長）'
            }
            placeholder="eyJ..."
            value={token}
            onChange={(e) => setToken(e.currentTarget.value)}
            autoComplete="off"
          />

          <TextInput
            label="Public Hostname"
            description="你在 Cloudflare dashboard 設定的 Public Hostname（含 subdomain）"
            placeholder="puffin.mememaker-tw.com"
            value={hostname}
            onChange={(e) => setHostname(e.currentTarget.value)}
            autoComplete="off"
          />

          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Button
                color="mint"
                size="xs"
                onClick={handleSave}
                loading={busy && !testing}
                disabled={!token.trim() || !hostname.trim()}
              >
                儲存設定
              </Button>
              <Button
                variant="light"
                color="sky"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={handleTest}
                loading={testing}
                disabled={(!token.trim() && !config) || !hostname.trim()}
              >
                測試連線
              </Button>
            </Group>
            {config && (
              <Button
                variant="subtle"
                color="red"
                size="xs"
                leftSection={<IconTrash size={14} />}
                onClick={handleDelete}
                disabled={busy}
              >
                刪除設定
              </Button>
            )}
          </Group>

          {/* 狀態 / 測試結果 */}
          {config && (
            <Card padding="xs" withBorder radius="sm" style={{ backgroundColor: '#FDFAF6' }}>
              <Stack gap={4}>
                <Text size="xs">
                  <strong>儲存的 hostname：</strong>{config.publicHostname}
                </Text>
                {config.lastVerifiedAt ? (
                  <Group gap="xs">
                    <Badge color="mint" variant="light" size="xs">已驗證</Badge>
                    <Text size="xs" c="dimmed">
                      最後測試：{new Date(config.lastVerifiedAt).toLocaleString('zh-TW')}
                    </Text>
                  </Group>
                ) : config.lastError ? (
                  <Group gap="xs" align="flex-start">
                    <Badge color="red" variant="light" size="xs">測試失敗</Badge>
                    <Text size="xs" c="red" style={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                      {config.lastError}
                    </Text>
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">
                    尚未測試過。建議按「測試連線」確認設定正確。
                  </Text>
                )}
              </Stack>
            </Card>
          )}

          {testResult && (
            <Alert
              color={testResult.ok ? 'mint' : 'red'}
              variant="light"
              radius="md"
              icon={testResult.ok ? <IconCheck size={18} /> : <IconAlertTriangle size={18} />}
            >
              <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                {testResult.message}
              </Text>
            </Alert>
          )}
        </Stack>

        <Divider variant="dashed" />

        {/* === 通用：重下載 cloudflared === */}
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            cloudflared.exe 異常時可手動重新下載（自動下載失敗時用）
          </Text>
          <Button
            variant="light"
            color="walnut"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={handleRedownloadCf}
            loading={redownloadingCf}
          >
            重新下載 cloudflared（~30MB）
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
