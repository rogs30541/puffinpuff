import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Badge,
  Group,
  Switch,
  Divider,
  Button,
  Code,
  Modal,
  Loader
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSettings,
  IconShieldCheck,
  IconFolderOpen,
  IconTrash,
  IconPhoto,
  IconTransform,
  IconCheck,
  IconInfoCircle,
  IconRefresh,
  IconKey,
  IconAlertTriangle,
  IconFileDownload,
  IconDownload
} from '@tabler/icons-react';
import type { GcResult, MetaTokenRefreshResult, MetaUserTokenInfo } from '../../../shared/types';
import { TunnelConfigCard } from '../components/TunnelConfigCard';
import { CredentialsCard } from '../components/CredentialsCard';

interface SystemStats {
  thumbnailCount: number;
  thumbnailBytes: number;
  transcodedCount: number;
  transcodedBytes: number;
  historyCount: number;
  dataFolder: string;
}

function formatBytes(b: number): string {
  if (b === 0) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
}

function ConfirmModal({
  opened,
  onClose,
  title,
  message,
  confirmLabel,
  confirmColor = 'red',
  onConfirm
}: ConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} radius="xl" size="sm">
      <Stack gap="md">
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{message}</Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" color="walnut" onClick={onClose}>取消</Button>
          <Button
            color={confirmColor}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function SettingsPage() {
  const [autoLaunch, setAutoLaunchState] = useState(false);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [version, setVersion] = useState<string>('—');
  const [loading, setLoading] = useState(true);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmClearThumbs, setConfirmClearThumbs] = useState(false);
  const [confirmClearTranscoded, setConfirmClearTranscoded] = useState(false);
  const [lastGc, setLastGc] = useState<GcResult | null>(null);
  const [gcBusy, setGcBusy] = useState(false);
  const [metaTokens, setMetaTokens] = useState<MetaUserTokenInfo[]>([]);
  const [metaRefreshBusy, setMetaRefreshBusy] = useState(false);
  // v0.3.3：永久停用 AutoLaunch 自動保護
  const [autoLaunchPermDisabled, setAutoLaunchPermDisabled] = useState(false);
  // v0.4.0：自我更新檢查
  const [updateInfo, setUpdateInfo] = useState<{ latest: string; current: string; newer: boolean; downloadUrl?: string; releaseNotes?: string } | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  // v0.5.0：cloudflared 重下載按鈕已移到 TunnelConfigCard 內

  const refreshAll = useCallback(async () => {
    try {
      const [al, st, v, gc, mt, perm] = await Promise.all([
        window.puffin.system.getAutoLaunch(),
        window.puffin.system.getStats(),
        window.puffin.system.getVersion(),
        window.puffin.system.getLastGc(),
        window.puffin.system.listMetaUserTokens(),
        window.puffin.system.getAutoLaunchPermanentlyDisabled()
      ]);
      setAutoLaunchState(al);
      setStats(st);
      setVersion(v);
      setLastGc(gc);
      setMetaTokens(mt);
      setAutoLaunchPermDisabled(perm);
    } catch (e) {
      console.error('load settings failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
    // v0.4.0：啟動時靜默檢查更新
    window.puffin.system.checkForUpdate().then(setUpdateInfo).catch(() => {});
  }, [refreshAll]);

  const handleCheckUpdate = async () => {
    setUpdateBusy(true);
    try {
      const info = await window.puffin.system.checkForUpdate();
      setUpdateInfo(info);
      if (info.newer) {
        notifications.show({
          title: `🎉 有新版可用：v${info.latest}`,
          message: '請點下方「下載新版」前往下載',
          color: 'mint',
          icon: <IconDownload size={18} />
        });
      } else {
        notifications.show({
          title: '已是最新版',
          message: `目前 v${info.current}`,
          color: 'mint',
          icon: <IconCheck size={18} />
        });
      }
    } catch (e) {
      notifications.show({
        title: '檢查更新失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const result = await window.puffin.system.exportHistoryCsv();
      if (result.cancelled) return;
      if (result.ok) {
        notifications.show({
          title: '匯出成功',
          message: `${result.rows} 筆紀錄已匯出到「${result.path}」`,
          color: 'mint',
          icon: <IconCheck size={18} />
        });
      }
    } catch (e) {
      notifications.show({
        title: '匯出失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setExportingCsv(false);
    }
  };

  const handleToggleAutoLaunch = async (enabled: boolean) => {
    try {
      const actual = await window.puffin.system.setAutoLaunch(enabled);
      setAutoLaunchState(actual);
      if (actual) {
        notifications.show({
          title: '已啟用開機自動啟動',
          message: '電腦開機後 PuffinPuff 會自動啟動接管排程',
          color: 'mint',
          icon: <IconCheck size={18} />
        });
      } else if (!autoLaunchPermDisabled) {
        // v0.3.3：使用者關掉但沒勾「永久停用」→ 提醒會被下次啟動自動修復
        notifications.show({
          title: '已暫時關閉開機自動啟動',
          message: '⚠ 提醒：App 下次重啟仍會自動重新啟用此選項。要永久關閉請勾選下方「永久停用此保護」。',
          color: 'mango',
          icon: <IconAlertTriangle size={18} />,
          autoClose: 8000
        });
      } else {
        notifications.show({
          title: '已關閉開機自動啟動',
          message: '永久停用模式：App 下次重啟不會再自動打開此選項',
          color: 'walnut',
          icon: <IconCheck size={18} />
        });
      }
    } catch (e) {
      notifications.show({
        title: '設定失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  // v0.3.3：勾選「永久停用此保護」
  const handleTogglePermanentDisable = async (checked: boolean) => {
    try {
      const actual = await window.puffin.system.setAutoLaunchPermanentlyDisabled(checked);
      setAutoLaunchPermDisabled(actual);
      if (actual) {
        // 同時關掉 main switch（後端 setAutoLaunchPermanentlyDisabled 內部已 setAutoLaunch(false)）
        setAutoLaunchState(false);
        notifications.show({
          title: '已永久停用 AutoLaunch 自動保護',
          message: 'App 不會再每次啟動重新打開「開機自動啟動」。可隨時取消勾選恢復保護。',
          color: 'walnut',
          icon: <IconCheck size={18} />
        });
      } else {
        notifications.show({
          title: '已恢復 AutoLaunch 自動保護',
          message: 'App 下次啟動會自動重新打開「開機自動啟動」（若目前是關閉狀態）',
          color: 'mint',
          icon: <IconCheck size={18} />
        });
      }
    } catch (e) {
      notifications.show({
        title: '設定失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  const handleOpenFolder = () => {
    window.puffin.system.openDataFolder().catch(() => {});
  };

  const handleClearHistory = async () => {
    try {
      const deleted = await window.puffin.system.clearHistory();
      notifications.show({
        title: '歷史已清空',
        message: `刪除 ${deleted} 筆紀錄（排程中的不會被刪）`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      await refreshAll();
    } catch (e) {
      notifications.show({
        title: '清空失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  const handleClearThumbs = async () => {
    try {
      const result = await window.puffin.system.clearThumbnails();
      notifications.show({
        title: '縮圖快取已清空',
        message: `刪除 ${result.deleted} 個檔案，釋放 ${formatBytes(result.freedBytes)}`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      await refreshAll();
    } catch (e) {
      notifications.show({
        title: '清空失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  const handleClearTranscoded = async () => {
    try {
      const result = await window.puffin.system.clearTranscoded();
      notifications.show({
        title: '轉檔快取已清空',
        message: `刪除 ${result.deleted} 個檔案，釋放 ${formatBytes(result.freedBytes)}`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      await refreshAll();
    } catch (e) {
      notifications.show({
        title: '清空失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  const handleRefreshMetaTokens = async () => {
    setMetaRefreshBusy(true);
    try {
      const results: MetaTokenRefreshResult[] = await window.puffin.system.refreshMetaTokens();
      if (results.length === 0) {
        notifications.show({
          title: '尚未連結 Meta 帳號',
          message: '請先到「帳號」頁連結 Facebook → 系統才會儲存 user token 並啟用自動續期',
          color: 'mango',
          icon: <IconAlertTriangle size={18} />
        });
      } else {
        const refreshed = results.filter((r) => r.status === 'refreshed').length;
        const stillFresh = results.filter((r) => r.status === 'still-fresh').length;
        const failed = results.filter((r) => r.status === 'failed').length;
        if (failed === 0) {
          notifications.show({
            title: 'Meta token 已檢查',
            message: `共 ${results.length} 個帳號：續期 ${refreshed}、仍新 ${stillFresh}`,
            color: 'mint',
            icon: <IconCheck size={18} />
          });
        } else {
          notifications.show({
            title: 'Meta token 部分失敗',
            message: `成功 ${refreshed + stillFresh} / 失敗 ${failed}（請至「帳號」頁重新連結失敗的帳號）`,
            color: 'red',
            icon: <IconAlertTriangle size={18} />
          });
        }
      }
      await refreshAll();
    } catch (e) {
      notifications.show({
        title: 'refresh 失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setMetaRefreshBusy(false);
    }
  };

  const handleRunGcNow = async () => {
    setGcBusy(true);
    try {
      const r = await window.puffin.system.runGcNow();
      setLastGc(r);
      notifications.show({
        title: '已執行自動清理',
        message: `轉檔 ${r.transcoded.deleted}/${r.transcoded.scanned}（${formatBytes(r.transcoded.freedBytes)})；縮圖 ${r.thumbnails.deleted}/${r.thumbnails.scanned}（${formatBytes(r.thumbnails.freedBytes)})`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      await refreshAll();
    } catch (e) {
      notifications.show({
        title: '清理失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setGcBusy(false);
    }
  };

  return (
    <Stack gap="lg" py="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} c="walnut.8">設定</Title>
          <Text c="dimmed" size="sm" mt={4}>
            調整 App 行為與資料管理。
          </Text>
        </div>
        {loading && <Loader size="sm" color="mint" />}
      </Group>

      {/* === 排程容錯 === */}
      <Card>
        <Stack gap="md">
          <Group gap="sm">
            <IconShieldCheck size={20} color="#6FBF9D" />
            <Title order={4} c="walnut.7">排程容錯</Title>
          </Group>
          <Divider />

          <Switch
            label="電腦開機時自動啟動 PuffinPuff"
            description="開機後 App 在背景待命接管排程；不啟用時，排程只在 App 開著才會觸發。建議啟用以避免電腦關機錯過排程。"
            checked={autoLaunch}
            onChange={(e) => handleToggleAutoLaunch(e.currentTarget.checked)}
            color="mint"
            size="md"
            disabled={autoLaunchPermDisabled}
          />

          {/* v0.3.3：永久停用保護的開關 */}
          <Card padding="sm" style={{ backgroundColor: autoLaunchPermDisabled ? '#FFEEC0' : '#F1FAF6' }}>
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="sm" fw={600} c="walnut.7">
                  🛡️ 自動保護機制
                </Text>
                <Switch
                  label="永久停用此保護"
                  labelPosition="left"
                  checked={autoLaunchPermDisabled}
                  onChange={(e) => handleTogglePermanentDisable(e.currentTarget.checked)}
                  color="red"
                  size="xs"
                />
              </Group>
              <Text size="xs" c="dimmed">
                {autoLaunchPermDisabled
                  ? '⚠ 自動保護已停用：上面 switch 你關了就會永遠關（App 不會再自動打開）'
                  : '✓ 自動保護啟用中：即使你關掉上面 switch，App 下次啟動仍會自動重新打開（避免你忘記再次啟用導致排程不準）。要真的永久關掉請打開此開關。'}
              </Text>
            </Stack>
          </Card>

          <Text size="xs" c="dimmed">
            ✓ 排程立即落盤、App 啟動自動恢復卡死紀錄、補發 6 小時內錯過的排程
          </Text>
        </Stack>
      </Card>

      {/* === 資料管理 === */}
      <Card>
        <Stack gap="md">
          <Group gap="sm">
            <IconFolderOpen size={20} color="#7C736B" />
            <Title order={4} c="walnut.7">資料管理</Title>
          </Group>
          <Divider />

          <Group gap="md" wrap="wrap">
            <Badge variant="light" color="sky">
              📊 歷史紀錄 {stats?.historyCount ?? '—'} 筆
            </Badge>
            <Badge variant="light" color="lavender">
              🖼 縮圖快取 {stats?.thumbnailCount ?? '—'} 個（{stats ? formatBytes(stats.thumbnailBytes) : '—'}）
            </Badge>
            <Badge variant="light" color="mango">
              🎬 轉檔快取 {stats?.transcodedCount ?? '—'} 個（{stats ? formatBytes(stats.transcodedBytes) : '—'}）
            </Badge>
          </Group>

          <Group>
            <Button
              variant="light"
              color="walnut"
              leftSection={<IconFolderOpen size={16} />}
              onClick={handleOpenFolder}
            >
              打開資料夾位置
            </Button>
            <Button
              variant="light"
              color="mango"
              leftSection={<IconPhoto size={16} />}
              onClick={() => setConfirmClearThumbs(true)}
              disabled={!stats || stats.thumbnailCount === 0}
            >
              清空縮圖快取
            </Button>
            <Button
              variant="light"
              color="mango"
              leftSection={<IconTransform size={16} />}
              onClick={() => setConfirmClearTranscoded(true)}
              disabled={!stats || stats.transcodedCount === 0}
            >
              清空轉檔快取
            </Button>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => setConfirmClearHistory(true)}
              disabled={!stats || stats.historyCount === 0}
            >
              清空歷史紀錄
            </Button>
            <Button
              variant="light"
              color="sky"
              leftSection={<IconFileDownload size={16} />}
              onClick={handleExportCsv}
              loading={exportingCsv}
              disabled={!stats || stats.historyCount === 0}
            >
              匯出歷史 CSV
            </Button>
          </Group>

          <Divider />

          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text size="sm" fw={600} c="walnut.7">
                自動清理（30 天未用的轉檔 / 90 天未用的縮圖）
              </Text>
              {lastGc ? (
                <Text size="xs" c="dimmed">
                  上次：{new Date(lastGc.ranAt).toLocaleString('zh-TW')}　|
                  轉檔 {lastGc.transcoded.deleted}/{lastGc.transcoded.scanned} 個（{formatBytes(lastGc.transcoded.freedBytes)}）|
                  縮圖 {lastGc.thumbnails.deleted}/{lastGc.thumbnails.scanned} 個（{formatBytes(lastGc.thumbnails.freedBytes)}）
                </Text>
              ) : (
                <Text size="xs" c="dimmed">
                  尚未執行過自動清理（App 啟動時會自動跑一次）
                </Text>
              )}
            </Stack>
            <Button
              variant="light"
              color="mint"
              size="xs"
              leftSection={<IconRefresh size={14} />}
              onClick={handleRunGcNow}
              loading={gcBusy}
            >
              立即清理
            </Button>
          </Group>

          <Text size="xs" c="dimmed">
            清空歷史**不會**刪除排程中的項目；帳號 token 也保留。
            <br />
            縮圖會在下次匯入影片時自動重新生成。
          </Text>

          {stats?.dataFolder && (
            <Code block style={{ fontSize: 11 }}>
              {stats.dataFolder}
            </Code>
          )}
        </Stack>
      </Card>

      {/* === Meta token 自動續期 === */}
      <Card>
        <Stack gap="md">
          <Group gap="sm">
            <IconKey size={20} color="#6FBF9D" />
            <Title order={4} c="walnut.7">Meta 連線自動續期</Title>
          </Group>
          <Divider />

          <Text size="xs" c="dimmed">
            Meta long-lived user token 預設 60 天到期。PuffinPuff 每 24 小時自動檢查，
            剩餘到期 {'<'} 7 天時自動 refresh 換新 60 天 token，並重新抓 Pages 同步所有 FB / IG 帳號 token。
            <br />
            <strong>需先到「帳號」頁連結 Facebook 才會啟用此功能</strong>（v0.2.5 之後重新連結才會記錄 user-level token）。
          </Text>

          {metaTokens.length === 0 ? (
            <Group gap="sm" align="center">
              <IconAlertTriangle size={18} color="#E8A33D" />
              <Text size="sm" c="dimmed">
                目前沒有儲存的 Meta user token。請至「帳號」頁連結 Facebook 啟用自動續期。
              </Text>
            </Group>
          ) : (
            <Stack gap="xs">
              {metaTokens.map((t) => {
                const days = Math.floor(t.remainingMs / (24 * 60 * 60 * 1000));
                const isExpiring = days < 7;
                const isExpired = days < 0;
                const color = isExpired ? 'red' : isExpiring ? 'mango' : 'mint';
                return (
                  <Card key={t.id} padding="sm" withBorder radius="md" style={{ backgroundColor: '#FDFAF6' }}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Group gap="xs">
                          <Text fw={600} size="sm">{t.fbUserName ?? '(未命名 Meta 使用者)'}</Text>
                          <Badge color={color} variant="light" size="xs">
                            {isExpired ? `已過期 ${Math.abs(days)} 天` : `剩 ${days} 天`}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed">
                          FB User ID：{t.fbUserId}
                        </Text>
                        <Text size="xs" c="dimmed">
                          到期：{new Date(t.expiresAt).toLocaleString('zh-TW')}
                        </Text>
                        {t.lastRefreshAt && (
                          <Text size="xs" c="dimmed">
                            上次自動續期：{new Date(t.lastRefreshAt).toLocaleString('zh-TW')}
                          </Text>
                        )}
                        {t.lastRefreshError && (
                          <Text size="xs" c="red">
                            上次錯誤：{t.lastRefreshError}
                          </Text>
                        )}
                      </Stack>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          )}

          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              點下方按鈕**強制立即執行**一次 refresh（不等到期視窗）。
            </Text>
            <Button
              variant="light"
              color="mint"
              size="xs"
              leftSection={<IconRefresh size={14} />}
              onClick={handleRefreshMetaTokens}
              loading={metaRefreshBusy}
            >
              立即刷新 Meta token
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* === v0.5.0：IG 隧道工具（含 Named Tunnel 設定）=== */}
      <CredentialsCard />

      <TunnelConfigCard />

      {/* === v0.6.9：DevTools 開關 === */}
      <Card>
        <Stack gap="sm">
          <Group gap="sm">
            <IconSettings size={20} color="#7C736B" />
            <Title order={4} c="walnut.7">開發者工具</Title>
          </Group>
          <Divider />
          <Text size="xs" c="dimmed">
            遇到問題時打開 DevTools 看 Console 詳細錯誤訊息。失敗時的 IG poll-status 錯誤會自動印在 main process console（不在 renderer console，可能要切到「Main」分頁）。
          </Text>
          <Group justify="flex-end">
            <Button
              variant="light"
              color="walnut"
              size="xs"
              onClick={async () => {
                try {
                  await window.puffin.system.openDevTools();
                } catch (e) {
                  notifications.show({
                    title: '開啟 DevTools 失敗',
                    message: (e as Error).message,
                    color: 'red'
                  });
                }
              }}
            >
              🔬 開啟 DevTools
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* === 關於 === */}
      <Card>
        <Stack gap="sm">
          <Group gap="sm">
            <IconInfoCircle size={20} color="#7C736B" />
            <Title order={4} c="walnut.7">關於</Title>
          </Group>
          <Divider />
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text size="sm">海鸚泡芙 PuffinPuff</Text>
              <Group gap="xs">
                <Badge color="mint" variant="light">v{version}</Badge>
                {updateInfo?.newer && (
                  <Badge color="mango" variant="filled">
                    🎉 有新版 v{updateInfo.latest}
                  </Badge>
                )}
              </Group>
            </Stack>
            <Group gap="xs">
              {updateInfo?.newer && updateInfo.downloadUrl && (
                <Button
                  variant="filled"
                  color="mango"
                  size="xs"
                  leftSection={<IconDownload size={14} />}
                  onClick={() => window.open(updateInfo.downloadUrl, '_blank')}
                >
                  下載新版
                </Button>
              )}
              <Button
                variant="light"
                color="mint"
                size="xs"
                leftSection={<IconRefresh size={14} />}
                onClick={handleCheckUpdate}
                loading={updateBusy}
              >
                檢查更新
              </Button>
            </Group>
          </Group>
          {updateInfo?.newer && updateInfo.releaseNotes && (
            <Card padding="xs" style={{ backgroundColor: '#FFEEC0' }}>
              <Text size="xs" fw={600} mb={4}>更新內容（v{updateInfo.latest}）：</Text>
              <Text size="xs" c="walnut.7" style={{ whiteSpace: 'pre-wrap' }}>
                {updateInfo.releaseNotes}
              </Text>
            </Card>
          )}
          <Text size="xs" c="dimmed">撲通一聲，內容飛上三平台。</Text>
          <Text size="xs" c="dimmed">© 2026 VVLEE</Text>
        </Stack>
      </Card>

      <Card>
        <Stack gap="sm">
          <Group gap="sm">
            <IconSettings size={20} color="#7C736B" />
            <Title order={4} c="walnut.7">通用偏好</Title>
          </Group>
          <Divider />
          <Switch
            label="Windows 通知中心"
            description="發布完成或失敗時以系統通知告知（目前永遠啟用）"
            color="mint"
            checked
            disabled
          />
          <Switch
            label="自動轉檔（HEVC → H.264）"
            description="影片規格不符時自動轉成 1080×1920 30fps（V1.1 接入）"
            color="mint"
            checked
            disabled
          />
        </Stack>
      </Card>

      <ConfirmModal
        opened={confirmClearHistory}
        onClose={() => setConfirmClearHistory(false)}
        title="確認清空歷史紀錄"
        message={`將刪除 ${stats?.historyCount ?? 0} 筆紀錄（已完成、失敗、草稿都會清）。\n\n排程中（尚未觸發）的不會被刪、帳號授權也保留。\n\n此動作無法復原。`}
        confirmLabel="清空"
        confirmColor="red"
        onConfirm={handleClearHistory}
      />

      <ConfirmModal
        opened={confirmClearThumbs}
        onClose={() => setConfirmClearThumbs(false)}
        title="確認清空縮圖快取"
        message={`將刪除 ${stats?.thumbnailCount ?? 0} 個縮圖檔（${stats ? formatBytes(stats.thumbnailBytes) : ''}）。\n\n下次匯入影片時會自動重新生成。`}
        confirmLabel="清空"
        confirmColor="mango"
        onConfirm={handleClearThumbs}
      />

      <ConfirmModal
        opened={confirmClearTranscoded}
        onClose={() => setConfirmClearTranscoded(false)}
        title="確認清空轉檔快取"
        message={`將刪除 ${stats?.transcodedCount ?? 0} 個已轉檔的暫存影片（${stats ? formatBytes(stats.transcodedBytes) : ''}）。\n\n下次發布相同來源影片時會重新轉檔（多花 30-90 秒）。`}
        confirmLabel="清空"
        confirmColor="mango"
        onConfirm={handleClearTranscoded}
      />
    </Stack>
  );
}
