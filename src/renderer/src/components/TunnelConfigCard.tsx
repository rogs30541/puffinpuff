/**
 * v0.5.0：IG 隧道工具設定卡片 → v0.8.0 改名「媒體發布通道」
 *
 * 三個模式：
 *   - s3（v0.8.0 新增，推薦）：雲端物件儲存（R2/S3/B2/MinIO），無 port / 無 cloudflared，
 *     可高頻無限並發，商用版主推
 *   - named-cloudflare：Cloudflare named tunnel（v0.8.0 起 singleton 常駐，port 只 bind 一次）
 *   - quick (預設)：cloudflared quick tunnel，零設定但 Cloudflare 對 IP 限流（error 1015）
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
import type { S3ConfigPublic, TunnelMode, TunnelNamedConfigPublic } from '../../../shared/types';

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

  // v0.8.0：S3 相容物件儲存
  const [s3Config, setS3Config] = useState<S3ConfigPublic | null>(null);
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('auto');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [s3PublicBaseUrl, setS3PublicBaseUrl] = useState('');
  const [s3Busy, setS3Busy] = useState(false);
  const [s3Testing, setS3Testing] = useState(false);
  const [s3TestResult, setS3TestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const reload = useCallback(async () => {
    const [m, c, p, s3] = await Promise.all([
      window.puffin.tunnel.getMode(),
      window.puffin.tunnel.getNamedConfig(),
      window.puffin.tunnel.getNamedLocalPort(),
      window.puffin.tunnel.getS3Config()
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
    setS3Config(s3);
    if (s3) {
      setS3Endpoint(s3.endpoint);
      setS3Bucket(s3.bucket);
      setS3Region(s3.region);
      setS3PublicBaseUrl(s3.publicBaseUrl ?? '');
      // keys 不回傳明文，欄位保持空白
      setS3AccessKey('');
      setS3SecretKey('');
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
    if (newMode === 's3' && !s3Config) {
      notifications.show({
        title: '請先儲存物件儲存設定',
        message: '填入 Endpoint / Bucket / Keys 並儲存後，才能切換到雲端物件儲存模式',
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
        title: '已切換媒體發布通道',
        message:
          newMode === 's3'
            ? '改用雲端物件儲存（無 port、可高頻並發）'
            : newMode === 'named-cloudflare'
              ? '改用 Cloudflare Named Tunnel（無 IP 限流）'
              : '改用 Quick Tunnel（無帳號 ad-hoc 隧道）',
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

  // ===== v0.8.0：S3 handlers =====

  const handleS3Save = async (): Promise<void> => {
    if (!s3Endpoint.trim() || !s3Bucket.trim()) {
      notifications.show({ title: 'Endpoint / Bucket 不可為空', message: '', color: 'mango' });
      return;
    }
    if (!s3AccessKey.trim() || !s3SecretKey.trim()) {
      notifications.show({
        title: 'Keys 不可為空',
        message: '請填入 Access Key ID 與 Secret Access Key',
        color: 'mango'
      });
      return;
    }
    setS3Busy(true);
    try {
      const c = await window.puffin.tunnel.saveS3Config({
        endpoint: s3Endpoint.trim(),
        bucket: s3Bucket.trim(),
        region: s3Region.trim() || 'auto',
        accessKeyId: s3AccessKey.trim(),
        secretAccessKey: s3SecretKey.trim(),
        publicBaseUrl: s3PublicBaseUrl.trim() || null
      });
      setS3Config(c);
      setS3TestResult(null);
      notifications.show({
        title: '已儲存物件儲存設定',
        message: 'Keys 已用 Windows DPAPI 加密儲存。可直接按「測試連線」驗證',
        color: 'mint',
        icon: <IconCheck size={18} />
      });
    } catch (e) {
      notifications.show({ title: '儲存失敗', message: (e as Error).message, color: 'red' });
    } finally {
      setS3Busy(false);
    }
  };

  const handleS3Test = async (): Promise<void> => {
    if (!s3Endpoint.trim() || !s3Bucket.trim()) {
      notifications.show({ title: 'Endpoint / Bucket 不可為空', message: '', color: 'mango' });
      return;
    }
    if ((!s3AccessKey.trim() || !s3SecretKey.trim()) && !s3Config) {
      notifications.show({
        title: 'Keys 為空',
        message: '首次使用請先填 keys 再測試',
        color: 'mango'
      });
      return;
    }
    setS3Testing(true);
    setS3TestResult(null);
    try {
      // keys 空時 backend 會 fallback 用 DB 儲存的
      const r = await window.puffin.tunnel.testS3({
        endpoint: s3Endpoint.trim(),
        bucket: s3Bucket.trim(),
        region: s3Region.trim() || 'auto',
        accessKeyId: s3AccessKey.trim(),
        secretAccessKey: s3SecretKey.trim(),
        publicBaseUrl: s3PublicBaseUrl.trim() || null
      });
      setS3TestResult(r);
      const c = await window.puffin.tunnel.getS3Config();
      setS3Config(c);
    } catch (e) {
      setS3TestResult({ ok: false, message: (e as Error).message });
    } finally {
      setS3Testing(false);
    }
  };

  const handleS3Delete = async (): Promise<void> => {
    if (!confirm('確定要刪除物件儲存設定嗎？（若當前使用此模式，會自動切回 Quick Tunnel）')) return;
    setS3Busy(true);
    try {
      await window.puffin.tunnel.deleteS3Config();
      if (mode === 's3') {
        await window.puffin.tunnel.setMode('quick');
        setMode('quick');
      }
      setS3Config(null);
      setS3Endpoint('');
      setS3Bucket('');
      setS3Region('auto');
      setS3AccessKey('');
      setS3SecretKey('');
      setS3PublicBaseUrl('');
      setS3TestResult(null);
      notifications.show({
        title: '已刪除物件儲存設定',
        message: '',
        color: 'mint',
        icon: <IconCheck size={18} />
      });
    } catch (e) {
      notifications.show({ title: '刪除失敗', message: (e as Error).message, color: 'red' });
    } finally {
      setS3Busy(false);
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
          <Title order={4} c="walnut.7">媒體發布通道（IG / Threads）</Title>
        </Group>
        <Divider />

        <Text size="xs" c="dimmed">
          IG / Threads 的 API 需要一個「公開 HTTPS URL」讓 Meta 來抓媒體檔案。選擇 PuffinPuff 用哪種方式提供這個 URL。
        </Text>

        {/* === 模式選擇 === */}
        <Radio.Group
          value={mode}
          onChange={(v) => handleModeChange(v as TunnelMode)}
          label="通道模式"
        >
          <Stack gap="xs" mt="xs">
            <Radio
              value="s3"
              disabled={!s3Config}
              label={
                <Stack gap={0}>
                  <Group gap="xs">
                    <Text size="sm" fw={600}>☁️ 雲端物件儲存（推薦 — 穩定 + 可高頻）</Text>
                    {s3Config ? (
                      <Badge color="mint" variant="light" size="xs">已設定</Badge>
                    ) : (
                      <Badge color="dimmed" variant="light" size="xs">未設定（先填下方表單）</Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    上傳到你自己的 R2 / S3 / B2 / MinIO bucket，發完自動刪除。無本機 port、無 cloudflared、無限並發。
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
                    用你 Cloudflare 帳號下的 named tunnel，固定 hostname、無 IP 限流。v0.8.0 起常駐連線（不再反覆開關 port）。
                  </Text>
                </Stack>
              }
              color="mint"
            />
            <Radio
              value="quick"
              label={
                <Stack gap={0}>
                  <Text size="sm" fw={600}>Quick Tunnel（零設定）</Text>
                  <Text size="xs" c="dimmed">
                    每次發布隨機開一條 trycloudflare.com URL。零設定但 Cloudflare 對 IP 有限流（error 1015）。適合偶爾發布。
                  </Text>
                </Stack>
              }
              color="mint"
            />
          </Stack>
        </Radio.Group>

        <Divider variant="dashed" />

        {/* === v0.8.0：S3 物件儲存設定區 === */}
        <Stack gap="xs">
          <Text size="sm" fw={600} c="walnut.7">
            ☁️ 雲端物件儲存設定（S3 相容）
          </Text>

          <Alert color="sky" variant="light" radius="md" icon={<IconRocket size={18} />}>
            <Text size="xs">
              <strong>推薦用 Cloudflare R2（免費 10GB + 零出流量費）— 設定流程（~5 分鐘）：</strong>
              <br />
              1. Cloudflare dashboard → R2 → <strong>Create bucket</strong>（例 <Code>puffinpuff-media</Code>）
              <br />
              2. R2 → Manage API Tokens → <strong>Create API Token</strong>（權限：Object Read &amp; Write，範圍限定該 bucket）
              <br />
              3. 記下 <Code>Access Key ID</Code> / <Code>Secret Access Key</Code> / 帳號的 <Code>S3 Endpoint</Code>（形如 https://&lt;accountid&gt;.r2.cloudflarestorage.com）
              <br />
              4. 填入下方 → 儲存 → 測試連線
              <br />
              <strong>公開 URL 前綴</strong>：留空 = 用 presigned URL（bucket 免公開，較安全，推薦）；
              有綁 r2.dev 或自訂網域才需要填。
              <br />
              也支援 AWS S3 / Backblaze B2 / MinIO — 填各家的 endpoint 即可。
            </Text>
          </Alert>

          <TextInput
            label="Endpoint URL"
            description="S3 API endpoint（R2 形如 https://<accountid>.r2.cloudflarestorage.com）"
            placeholder="https://xxxxxxxx.r2.cloudflarestorage.com"
            value={s3Endpoint}
            onChange={(e) => setS3Endpoint(e.currentTarget.value)}
            autoComplete="off"
          />
          <Group grow>
            <TextInput
              label="Bucket 名稱"
              placeholder="puffinpuff-media"
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.currentTarget.value)}
              autoComplete="off"
            />
            <TextInput
              label="Region"
              description="R2 / MinIO 填 auto 即可"
              placeholder="auto"
              value={s3Region}
              onChange={(e) => setS3Region(e.currentTarget.value)}
              autoComplete="off"
            />
          </Group>
          <PasswordInput
            label="Access Key ID"
            description={s3Config?.hasKeys ? 'Keys 已加密儲存（DPAPI）。測試不需重貼；要換 keys 才需重新填。' : undefined}
            value={s3AccessKey}
            onChange={(e) => setS3AccessKey(e.currentTarget.value)}
            autoComplete="off"
          />
          <PasswordInput
            label="Secret Access Key"
            value={s3SecretKey}
            onChange={(e) => setS3SecretKey(e.currentTarget.value)}
            autoComplete="off"
          />
          <TextInput
            label="公開 URL 前綴（選填）"
            description="留空 = presigned URL 模式（推薦）。有綁公開域名才填，例 https://pub-xxxx.r2.dev"
            placeholder="（留空使用 presigned URL）"
            value={s3PublicBaseUrl}
            onChange={(e) => setS3PublicBaseUrl(e.currentTarget.value)}
            autoComplete="off"
          />

          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Button
                color="mint"
                size="xs"
                onClick={handleS3Save}
                loading={s3Busy && !s3Testing}
                disabled={!s3Endpoint.trim() || !s3Bucket.trim() || !s3AccessKey.trim() || !s3SecretKey.trim()}
              >
                儲存設定
              </Button>
              <Button
                variant="light"
                color="sky"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={handleS3Test}
                loading={s3Testing}
                disabled={!s3Endpoint.trim() || !s3Bucket.trim() || (!s3AccessKey.trim() && !s3Config)}
              >
                測試連線
              </Button>
            </Group>
            {s3Config && (
              <Button
                variant="subtle"
                color="red"
                size="xs"
                leftSection={<IconTrash size={14} />}
                onClick={handleS3Delete}
                disabled={s3Busy}
              >
                刪除設定
              </Button>
            )}
          </Group>

          {s3Config && (
            <Card padding="xs" withBorder radius="sm" style={{ backgroundColor: '#FDFAF6' }}>
              <Stack gap={4}>
                <Text size="xs">
                  <strong>Bucket：</strong>{s3Config.bucket}（{s3Config.publicBaseUrl ? '公開 URL 模式' : 'presigned URL 模式'}）
                </Text>
                {s3Config.lastVerifiedAt ? (
                  <Group gap="xs">
                    <Badge color="mint" variant="light" size="xs">已驗證</Badge>
                    <Text size="xs" c="dimmed">
                      最後測試：{new Date(s3Config.lastVerifiedAt).toLocaleString('zh-TW')}
                    </Text>
                  </Group>
                ) : s3Config.lastError ? (
                  <Group gap="xs" align="flex-start">
                    <Badge color="red" variant="light" size="xs">測試失敗</Badge>
                    <Text size="xs" c="red" style={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                      {s3Config.lastError}
                    </Text>
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">尚未測試過。建議按「測試連線」確認設定正確。</Text>
                )}
              </Stack>
            </Card>
          )}

          {s3TestResult && (
            <Alert
              color={s3TestResult.ok ? 'mint' : 'red'}
              variant="light"
              radius="md"
              icon={s3TestResult.ok ? <IconCheck size={18} /> : <IconAlertTriangle size={18} />}
            >
              <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                {s3TestResult.message}
              </Text>
            </Alert>
          )}
        </Stack>

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
