/**
 * v0.3.0：圖文批量排程 Modal
 * - 拖入資料夾（jpg/png + 同名 .txt 配對）
 * - 間隔模式排程
 * - 每平台目標帳號下拉
 */

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  Modal,
  Stack,
  Group,
  Card,
  Box,
  Text,
  Button,
  Divider,
  Select,
  NumberInput,
  Checkbox,
  TextInput,
  ScrollArea,
  Table,
  Badge,
  Alert,
  Image as MantineImage
} from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconFolder,
  IconCalendarTime,
  IconClock,
  IconAlertTriangle,
  IconCheck,
  IconPhoto,
  IconBrandFacebook,
  IconBrandInstagram
} from '@tabler/icons-react';
import type {
  AccountPublic,
  ImageFolderScanResult,
  ImagePostBulkRow,
  ImagePostPair
} from '../../../shared/types';
import { TemplateApplyBar } from './TemplateApplyBar';

interface Props {
  opened: boolean;
  onClose: () => void;
  onImported: () => void;
}

function toMediaUrl(filePath: string): string {
  return `puffin-media:///${encodeURI(filePath.replace(/\\/g, '/'))}`;
}

export function ImagePostBulkModal({ opened, onClose, onImported }: Props) {
  const [folderPath, setFolderPath] = useState('');
  const [pairs, setPairs] = useState<ImagePostPair[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [mode, setMode] = useState<'pair-files' | 'csv-manifest' | null>(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 排程：每日定時模式為主
  const [dailyStartDate, setDailyStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dailyTime, setDailyTime] = useState<string>('20:00');
  const [daysGap, setDaysGap] = useState(1);
  const [skipWeekends, setSkipWeekends] = useState(false);

  // 平台與帳號
  const [enableFB, setEnableFB] = useState(true);
  const [enableIG, setEnableIG] = useState(true);
  const [hashtags, setHashtags] = useState('');
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [targetFacebook, setTargetFacebook] = useState<string | null>(null);
  const [targetInstagram, setTargetInstagram] = useState<string | null>(null);

  // 開啟 modal 時載入帳號
  useEffect(() => {
    if (!opened) return;
    window.puffin.accounts.list().then((list) => {
      setAccounts(list);
      const firstFB = list.find((a) => a.platform === 'facebook');
      const firstIG = list.find((a) => a.platform === 'instagram');
      setTargetFacebook(firstFB ? String(firstFB.id) : null);
      setTargetInstagram(firstIG ? String(firstIG.id) : null);
    }).catch(() => {});
  }, [opened]);

  const fbAccounts = useMemo(() => accounts.filter((a) => a.platform === 'facebook'), [accounts]);
  const igAccounts = useMemo(() => accounts.filter((a) => a.platform === 'instagram'), [accounts]);

  const resetState = () => {
    setFolderPath('');
    setPairs([]);
    setWarnings([]);
    setMode(null);
  };

  const handleScanFolder = async (path: string) => {
    setScanning(true);
    try {
      const result: ImageFolderScanResult = await window.puffin.schedule.scanImageFolder(path);
      setFolderPath(result.folderPath);
      setPairs(result.pairs);
      setWarnings(result.warnings);
      setMode(result.mode);
      if (result.pairs.length === 0 && result.mode === 'pair-files') {
        notifications.show({
          title: '沒找到圖文配對',
          message: `「${path}」內沒有可配對的圖+文字。請看「圖文企劃方法論」文件範例。`,
          color: 'mango',
          icon: <IconAlertTriangle size={18} />
        });
      }
    } catch (e) {
      notifications.show({
        title: '掃描資料夾失敗',
        message: (e as Error).message,
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    } finally {
      setScanning(false);
    }
  };

  const handlePickFolder = async () => {
    const path = await window.puffin.schedule.openFolderDialog();
    if (path) await handleScanFolder(path);
  };

  const handleFolderDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const items = Array.from(e.dataTransfer.files);
    if (items.length === 0) return;
    const dropped = items[0];
    const path = window.puffin.media.getPathForFile(dropped);
    if (!path) {
      notifications.show({
        title: '無法取得資料夾路徑',
        message: '請改用「選擇資料夾」按鈕',
        color: 'mango'
      });
      return;
    }
    await handleScanFolder(path);
  };

  /** 計算第 idx 篇的排程時間（每日定時模式）*/
  const computeScheduledAt = (idx: number): number => {
    const [hStr, mStr] = dailyTime.split(':');
    const hour = parseInt(hStr ?? '20', 10);
    const minute = parseInt(mStr ?? '0', 10);
    const d = new Date(dailyStartDate);
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < idx; i++) {
      d.setDate(d.getDate() + daysGap);
      if (skipWeekends) {
        while (d.getDay() === 0 || d.getDay() === 6) {
          d.setDate(d.getDate() + 1);
        }
      }
    }
    if (skipWeekends && idx === 0) {
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
    }
    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  };

  /** v0.3.1：解析 account_alias 字串 → 對應到實際 account ID */
  const resolveAccountAlias = (alias: string | undefined, platform: 'facebook' | 'instagram'): number | undefined => {
    if (!alias) return undefined;
    // 格式：「fb:Page名稱 ig:Username」用空格 / 逗號分隔
    const tokens = alias.split(/[,\s|;]+/).map((s) => s.trim()).filter(Boolean);
    const prefix = platform === 'facebook' ? 'fb:' : 'ig:';
    for (const t of tokens) {
      const lower = t.toLowerCase();
      if (lower.startsWith(prefix)) {
        const name = t.slice(3).trim();
        const acc = (platform === 'facebook' ? fbAccounts : igAccounts)
          .find((a) => a.displayName === name || a.displayName === `@${name}`);
        if (acc) return acc.id;
      }
    }
    return undefined;
  };

  /** v0.3.1：圖片解析度警告（IG 標準）*/
  const checkImageDimensions = (pair: ImagePostPair, platforms: ('facebook' | 'instagram')[]): string[] => {
    if (!platforms.includes('instagram')) return [];
    const w = pair.imageWidth;
    const h = pair.imageHeight;
    if (!w || !h) return ['無法讀取解析度，IG 可能拒收'];
    const warns: string[] = [];
    if (w < 320 || h < 320) {
      warns.push(`解析度過低 ${w}×${h}（IG 最低 320×320）`);
    }
    const aspect = w / h;
    if (aspect < 0.79) warns.push(`太直 ${aspect.toFixed(2)}（IG 接受 0.8-1.91）`);
    else if (aspect > 1.92) warns.push(`太寬 ${aspect.toFixed(2)}（IG 接受 0.8-1.91）`);
    return warns;
  };

  const computedRows = useMemo<ImagePostBulkRow[]>(() => {
    const isCsvMode = mode === 'csv-manifest';
    return pairs.map((pair, idx) => {
      // === B 模式：用 pair.csv* 欄位（每篇獨立）===
      // === A 模式：用 Modal 全域設定 ===
      let platforms: ('facebook' | 'instagram')[] = [];
      let scheduledAt: number;
      let rowHashtags: string;
      let fbAccountId: number | undefined;
      let igAccountId: number | undefined;
      const errors: string[] = [];
      const warns: string[] = [];

      if (isCsvMode) {
        platforms = pair.csvPlatforms ?? [];
        scheduledAt = pair.csvScheduledAt ?? 0;
        rowHashtags = pair.csvHashtags ?? '';
        fbAccountId = resolveAccountAlias(pair.csvAccountAlias, 'facebook')
          ?? (targetFacebook ? parseInt(targetFacebook, 10) : undefined);
        igAccountId = resolveAccountAlias(pair.csvAccountAlias, 'instagram')
          ?? (targetInstagram ? parseInt(targetInstagram, 10) : undefined);
        // 把 CSV 解析錯誤拉進 errors
        if (pair.csvErrors) errors.push(...pair.csvErrors);
        if (platforms.length === 0) errors.push('CSV platforms 欄空');
      } else {
        if (enableFB) platforms.push('facebook');
        if (enableIG) platforms.push('instagram');
        scheduledAt = computeScheduledAt(idx);
        rowHashtags = hashtags;
        fbAccountId = targetFacebook ? parseInt(targetFacebook, 10) : undefined;
        igAccountId = targetInstagram ? parseInt(targetInstagram, 10) : undefined;
        if (platforms.length === 0) errors.push('至少要選一個平台');
        if (enableFB && !targetFacebook) errors.push('Facebook 未選帳號');
        if (enableIG && !targetInstagram) errors.push('Instagram 未選帳號');
      }

      if (scheduledAt < Date.now()) warns.push('時間在過去');
      // 圖片解析度警告（IG）
      warns.push(...checkImageDimensions(pair, platforms));
      // v0.3.2：carousel 警告
      if (pair.additionalImagePaths && pair.additionalImagePaths.length > 0) {
        if (platforms.includes('facebook')) {
          warns.push('FB 不支援多圖貼文（v0.3.2），會只發第 1 張');
        }
      }

      return {
        rowIndex: idx + 1,
        imagePath: pair.imagePath,
        imageName: pair.imageName,
        caption: pair.caption,
        hashtags: rowHashtags,
        scheduledAt,
        platforms,
        targetAccounts: {
          ...(fbAccountId ? { facebook: fbAccountId } : {}),
          ...(igAccountId ? { instagram: igAccountId } : {})
        },
        additionalImagePaths: pair.additionalImagePaths,
        errors,
        warnings: warns
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, mode, enableFB, enableIG, targetFacebook, targetInstagram, hashtags, dailyStartDate, dailyTime, daysGap, skipWeekends, fbAccounts, igAccounts]);

  const validCount = computedRows.filter((r) => r.errors.length === 0).length;
  const errorCount = computedRows.length - validCount;

  const handleImport = async () => {
    setImporting(true);
    try {
      const validRows = computedRows.filter((r) => r.errors.length === 0);
      const ids = await window.puffin.schedule.bulkCreateImagePosts(validRows);
      notifications.show({
        title: '圖文批量匯入完成',
        message: `成功建立 ${ids.length} 筆圖文排程${errorCount > 0 ? `（略過 ${errorCount} 筆錯誤）` : ''}`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      resetState();
      onImported();
      onClose();
    } catch (e) {
      notifications.show({
        title: '匯入失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        resetState();
        onClose();
      }}
      title={
        mode === 'csv-manifest'
          ? '批量匯入圖文排程（B 模式：CSV manifest）'
          : '批量匯入圖文排程（A 模式：配對檔案）'
      }
      size="92%"
      radius="xl"
    >
      <Stack gap="md">
        {/* Step 1：選/拖資料夾 */}
        {pairs.length === 0 && (
          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFolderDrop}
            style={{
              backgroundColor: isDragOver ? '#FCEAF1' : '#FFFFFF',
              borderColor: isDragOver ? '#E374A0' : '#F8C8DC',
              borderWidth: 2,
              borderStyle: 'dashed',
              borderRadius: 18,
              padding: 40,
              textAlign: 'center'
            }}
          >
            <Stack align="center" gap="md">
              <IconPhoto size={64} color={isDragOver ? '#E374A0' : '#F8C8DC'} stroke={1.5} />
              <div>
                <Text size="lg" fw={700}>
                  {isDragOver ? '放手吧 🐧' : '拖一整個圖文資料夾到這裡'}
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  資料夾內：每篇 1 個圖檔（jpg / png / webp / gif）+ 同名 .txt 文字檔
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  範例：001.jpg + 001.txt、02_勞資地雷.png + 02_勞資地雷.txt
                </Text>
              </div>
              <Button
                color="sakura"
                onClick={handlePickFolder}
                loading={scanning}
                leftSection={<IconFolder size={18} />}
              >
                選擇資料夾
              </Button>
            </Stack>
          </Box>
        )}

        {/* Step 2+3：設定 + 預覽 */}
        {pairs.length > 0 && (
          <>
            <Card padding="md">
              <Group justify="space-between" mb="sm">
                <Group gap="sm">
                  <IconFolder size={20} color="#F8C8DC" />
                  <div>
                    <Text fw={600} size="sm">{folderPath}</Text>
                    <Text size="xs" c="dimmed">
                      {pairs.length} 對配對成功 {mode === 'pair-files' && '· A 模式'}
                    </Text>
                  </div>
                </Group>
                <Button variant="subtle" color="walnut" size="xs" onClick={resetState}>
                  換另一個資料夾
                </Button>
              </Group>
              {warnings.length > 0 && (
                <Alert color="mango" variant="light" mt="sm" icon={<IconAlertTriangle size={16} />}>
                  <Stack gap={2}>
                    {warnings.slice(0, 5).map((w, i) => (
                      <Text key={i} size="xs">{w}</Text>
                    ))}
                    {warnings.length > 5 && <Text size="xs">…還有 {warnings.length - 5} 個警告</Text>}
                  </Stack>
                </Alert>
              )}
            </Card>

            {mode === 'csv-manifest' ? (
              // === B 模式：時間/平台/帳號/hashtag 全部由 CSV 控制，UI 只顯示說明 ===
              <Card padding="md" style={{ backgroundColor: '#F0E8F5' }}>
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconCalendarTime size={20} color="#A07AC2" />
                    <Text fw={600} c="walnut.8">B 模式：CSV manifest 控制</Text>
                  </Group>
                  <Text size="sm">
                    每篇貼文的<strong>時間 / 平台 / Hashtag</strong> 都從 manifest.csv 讀取，
                    UI 不需要設定全域規則。預覽表會顯示每篇的實際值。
                  </Text>
                  <Text size="xs" c="dimmed">
                    CSV 欄位：<code>filename, caption, hashtags, platforms, scheduled_at, account_alias</code>
                    （account_alias 選填，留空則用下方下拉選的預設帳號）
                  </Text>

                  <Divider />

                  <Text size="sm" fw={600} c="walnut.7">預設目標帳號（CSV 沒指定 account_alias 時用）</Text>
                  <Stack gap="xs">
                    <Select
                      label={<Group gap={4}><IconBrandFacebook size={14} color="#1877F2" /><Text size="xs">Facebook 粉專</Text></Group>}
                      placeholder={fbAccounts.length === 0 ? '請先連結 Facebook' : '選擇粉專'}
                      value={targetFacebook}
                      onChange={setTargetFacebook}
                      data={fbAccounts.map((a) => ({ value: String(a.id), label: a.displayName }))}
                      disabled={fbAccounts.length === 0}
                      radius="md"
                      size="xs"
                    />
                    <Select
                      label={<Group gap={4}><IconBrandInstagram size={14} color="#E4405F" /><Text size="xs">Instagram 帳號</Text></Group>}
                      placeholder={igAccounts.length === 0 ? '請先連結 Instagram' : '選擇 IG'}
                      value={targetInstagram}
                      onChange={setTargetInstagram}
                      data={igAccounts.map((a) => ({ value: String(a.id), label: a.displayName }))}
                      disabled={igAccounts.length === 0}
                      radius="md"
                      size="xs"
                    />
                  </Stack>
                </Stack>
              </Card>
            ) : (
              <Card padding="md">
                <Stack gap="md">
                  <Text fw={600} c="walnut.8">排程規則（每日定時）</Text>
                  <Group grow>
                    <DatePickerInput
                      label="起始日期"
                      value={dailyStartDate}
                      onChange={(v) => v && setDailyStartDate(new Date(v as unknown as string | Date))}
                      minDate={new Date()}
                      radius="md"
                      valueFormat="YYYY/MM/DD"
                      leftSection={<IconCalendarTime size={16} />}
                    />
                    <TimeInput
                      label="每日發佈時間"
                      value={dailyTime}
                      onChange={(e) => setDailyTime(e.currentTarget.value)}
                      radius="md"
                      leftSection={<IconClock size={16} />}
                    />
                    <NumberInput
                      label="每 N 天一篇"
                      value={daysGap}
                      onChange={(v) => setDaysGap(typeof v === 'number' && v > 0 ? v : 1)}
                      min={1}
                      max={30}
                      radius="md"
                    />
                  </Group>
                  <Checkbox
                    label="跳過週六日"
                    checked={skipWeekends}
                    onChange={(e) => setSkipWeekends(e.currentTarget.checked)}
                    color="sakura"
                  />

                  <Divider />

                  <Text fw={600} c="walnut.8">發佈平台與帳號</Text>
                  <Group gap="sm">
                    <Checkbox
                      label={
                        <Group gap={4}><IconBrandFacebook size={16} color="#1877F2" /><Text size="sm">Facebook 粉專</Text></Group>
                      }
                      checked={enableFB}
                      onChange={(e) => setEnableFB(e.currentTarget.checked)}
                      color="sky"
                    />
                    <Checkbox
                      label={
                        <Group gap={4}><IconBrandInstagram size={16} color="#E4405F" /><Text size="sm">Instagram Feed</Text></Group>
                      }
                      checked={enableIG}
                      onChange={(e) => setEnableIG(e.currentTarget.checked)}
                      color="sakura"
                    />
                    <Text size="xs" c="dimmed">（圖文不適用 YouTube）</Text>
                  </Group>

                  <Stack gap="xs">
                    {enableFB && (
                      <Select
                        label={<Group gap={4}><IconBrandFacebook size={14} color="#1877F2" /><Text size="xs">Facebook 粉專帳號</Text></Group>}
                        placeholder={fbAccounts.length === 0 ? '請先連結 Facebook' : '選擇粉專'}
                        value={targetFacebook}
                        onChange={setTargetFacebook}
                        data={fbAccounts.map((a) => ({ value: String(a.id), label: a.displayName }))}
                        disabled={fbAccounts.length === 0}
                        radius="md"
                        size="xs"
                      />
                    )}
                    {enableIG && (
                      <Select
                        label={<Group gap={4}><IconBrandInstagram size={14} color="#E4405F" /><Text size="xs">Instagram 帳號</Text></Group>}
                        placeholder={igAccounts.length === 0 ? '請先連結 Instagram' : '選擇 IG'}
                        value={targetInstagram}
                        onChange={setTargetInstagram}
                        data={igAccounts.map((a) => ({ value: String(a.id), label: a.displayName }))}
                        disabled={igAccounts.length === 0}
                        radius="md"
                        size="xs"
                      />
                    )}
                  </Stack>

                  <Divider />

                  <TemplateApplyBar
                    mode="image-post"
                    onApply={(t) => {
                      if (t.hashtags !== null && t.hashtags !== undefined) setHashtags(t.hashtags);
                    }}
                    getCurrentSnapshot={() => ({
                      titleTemplate: null,
                      description: null,
                      hashtags: hashtags || null,
                      privacy: null
                    })}
                  />

                  <TextInput
                    label="共通 Hashtag"
                    description="會加到每篇 caption 末尾"
                    placeholder="#勞資顧問 #勞動法 #人資"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.currentTarget.value)}
                  />
                </Stack>
              </Card>
            )}

            <Divider />

            <Group justify="space-between">
              <Text size="sm" fw={600}>
                預覽 {computedRows.length} 篇 ·{' '}
                <Text component="span" c="mint.7">{validCount} 有效</Text>
                {errorCount > 0 && (
                  <>
                    {' / '}
                    <Text component="span" c="red.7">{errorCount} 錯誤</Text>
                  </>
                )}
              </Text>
              <Button
                color="sakura"
                onClick={handleImport}
                loading={importing}
                disabled={validCount === 0}
                leftSection={<IconCalendarTime size={16} />}
              >
                建立 {validCount} 篇圖文排程
              </Button>
            </Group>

            <ScrollArea h={400}>
              <Table verticalSpacing="xs" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>狀態</Table.Th>
                    <Table.Th>縮圖</Table.Th>
                    <Table.Th>檔案 / Caption 前 60 字</Table.Th>
                    <Table.Th>解析度</Table.Th>
                    <Table.Th>時間</Table.Th>
                    <Table.Th>平台</Table.Th>
                    <Table.Th>問題</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {computedRows.map((row, idx) => {
                    const pair = pairs[idx];
                    const captionPreview = pair.caption.replace(/\s+/g, ' ').slice(0, 60);
                    const dim = pair.imageWidth && pair.imageHeight
                      ? `${pair.imageWidth}×${pair.imageHeight}`
                      : '?';
                    const aspect = pair.imageWidth && pair.imageHeight
                      ? (pair.imageWidth / pair.imageHeight).toFixed(2)
                      : '';
                    return (
                      <Table.Tr key={pair.imagePath}>
                        <Table.Td>{row.rowIndex}</Table.Td>
                        <Table.Td>
                          {row.errors.length > 0 ? (
                            <Badge color="red" variant="light" size="sm">✕ 錯誤</Badge>
                          ) : row.warnings.length > 0 ? (
                            <Badge color="mango" variant="light" size="sm">⚠ 警告</Badge>
                          ) : (
                            <Badge color="mint" variant="light" size="sm">✓ OK</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <MantineImage
                            src={toMediaUrl(pair.imagePath)}
                            w={60}
                            h={75}
                            fit="cover"
                            radius="sm"
                            fallbackSrc="https://placehold.co/60x75/D2CCC4/3F3A36?text=img"
                          />
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={0}>
                            <Group gap={4}>
                              <Text size="xs" fw={600} lineClamp={1}>{pair.baseName}</Text>
                              {pair.additionalImagePaths && pair.additionalImagePaths.length > 0 && (
                                <Badge color="lavender" variant="light" size="xs">
                                  Carousel {pair.additionalImagePaths.length + 1} 張
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed" lineClamp={2}>{captionPreview}…</Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={0}>
                            <Text size="xs" fw={500}>{dim}</Text>
                            {aspect && <Text size="xs" c="dimmed">{aspect}:1</Text>}
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">
                            {new Date(row.scheduledAt).toLocaleString('zh-TW', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4}>
                            {row.platforms.includes('facebook') && <IconBrandFacebook size={14} color="#1877F2" />}
                            {row.platforms.includes('instagram') && <IconBrandInstagram size={14} color="#E4405F" />}
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ maxWidth: 200 }}>
                          {row.errors.length > 0 && (
                            <Text size="xs" c="red">{row.errors.join('、')}</Text>
                          )}
                          {row.warnings.length > 0 && (
                            <Text size="xs" c="orange">{row.warnings.join('、')}</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </>
        )}
      </Stack>
    </Modal>
  );
}
