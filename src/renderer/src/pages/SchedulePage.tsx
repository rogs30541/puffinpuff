import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  Stack,
  Title,
  Text,
  Badge,
  Group,
  Card,
  Center,
  Loader,
  Button,
  Modal,
  Table,
  ScrollArea,
  Avatar,
  Divider,
  TextInput,
  NumberInput,
  Checkbox,
  Box,
  Textarea,
  Radio,
  SegmentedControl,
  Alert,
  Select
} from '@mantine/core';
import { DateTimePicker, DatePickerInput, TimeInput } from '@mantine/dates';
import { Calendar, dayjsLocalizer, Views, type View } from 'react-big-calendar';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-tw';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarEvent,
  IconCalendarTime,
  IconClock,
  IconTrash,
  IconFolder,
  IconAlertTriangle,
  IconCheck,
  IconBrandYoutube,
  IconBrandFacebook,
  IconBrandInstagram,
  IconShieldCheck,
  type Icon
} from '@tabler/icons-react';
import {
  BRAND_DEFAULTS,
  substituteTitleFilename,
  type AccountPublic,
  type BulkScheduleRow,
  type FolderVideoFile,
  type PostRecord
} from '../../../shared/types';
import { VideoPreviewModal } from '../components/VideoPreviewModal';
import { ImagePostBulkModal } from '../components/ImagePostBulkModal';
import { WatchersModal } from '../components/WatchersModal';
import { TemplateApplyBar } from '../components/TemplateApplyBar';

const PLATFORM_ICON: Record<
  'youtube' | 'facebook' | 'instagram',
  { icon: Icon; color: string; name: string }
> = {
  youtube: { icon: IconBrandYoutube, color: '#FF0000', name: 'YouTube' },
  facebook: { icon: IconBrandFacebook, color: '#1877F2', name: 'Facebook' },
  instagram: { icon: IconBrandInstagram, color: '#E4405F', name: 'Instagram' }
};

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeUntil(ts: number): string {
  const diff = ts - Date.now();
  if (diff < 0) return '已過時';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分鐘後`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時 ${mins % 60} 分後`;
  const days = Math.floor(hours / 24);
  return `${days} 天 ${hours % 24} 小時後`;
}

function formatSize(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

dayjs.locale('zh-tw');
const localizer = dayjsLocalizer(dayjs);

const CALENDAR_MESSAGES = {
  today: '今天',
  previous: '◀',
  next: '▶',
  month: '月',
  week: '週',
  day: '天',
  agenda: '議程',
  date: '日期',
  time: '時間',
  event: '排程',
  noEventsInRange: '此區間沒有排程',
  showMore: (total: number) => `+${total} 更多`,
  allDay: '全天',
  yesterday: '昨天',
  tomorrow: '明天',
  work_week: '工作週'
};

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: PostRecord;
}

function toMediaUrl(filePath: string | null): string | undefined {
  if (!filePath) return undefined;
  return `puffin-media:///${encodeURI(filePath.replace(/\\/g, '/'))}`;
}

function getEnabledPlatforms(post: PostRecord): ('youtube' | 'facebook' | 'instagram')[] {
  if (!post.contentJson) return [];
  try {
    const c = JSON.parse(post.contentJson);
    const result: ('youtube' | 'facebook' | 'instagram')[] = [];
    if (c.perPlatform?.youtube?.enabled) result.push('youtube');
    if (c.perPlatform?.facebook?.enabled) result.push('facebook');
    if (c.perPlatform?.instagram?.enabled) result.push('instagram');
    return result;
  } catch {
    return [];
  }
}

interface BulkImportModalProps {
  opened: boolean;
  onClose: () => void;
  onImported: () => void;
}

function BulkImportModal({ opened, onClose, onImported }: BulkImportModalProps) {
  const [files, setFiles] = useState<FolderVideoFile[]>([]);
  const [folderPath, setFolderPath] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // 排程模式
  const [scheduleMode, setScheduleMode] = useState<'interval' | 'daily'>('daily');

  // 模式 A：間隔
  const [startAt, setStartAt] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    d.setSeconds(0, 0);
    return d;
  });
  const [intervalHours, setIntervalHours] = useState<number>(24);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(0);

  // 模式 B：每日定時
  const [dailyStartDate, setDailyStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [postsPerDay, setPostsPerDay] = useState<number>(1);
  // 至多 3 個時段；長度恆 = postsPerDay
  const [dailyTimes, setDailyTimes] = useState<string[]>(['20:00', '14:00', '10:00']);
  const [daysGap, setDaysGap] = useState<number>(1);
  const [skipWeekends, setSkipWeekends] = useState<boolean>(false);

  const updateDailyTime = (slotIdx: number, value: string) => {
    setDailyTimes((prev) => {
      const next = [...prev];
      next[slotIdx] = value;
      return next;
    });
  };

  // 其他全域
  const [platforms, setPlatforms] = useState<('youtube' | 'facebook' | 'instagram')[]>([
    'youtube',
    'facebook',
    'instagram'
  ]);
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState(BRAND_DEFAULTS.hashtags);
  const [titleTemplate, setTitleTemplate] = useState(BRAND_DEFAULTS.titleTemplate);

  // v0.2.9：多帳號管理
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [targetYouTube, setTargetYouTube] = useState<string | null>(null);
  const [targetFacebook, setTargetFacebook] = useState<string | null>(null);
  const [targetInstagram, setTargetInstagram] = useState<string | null>(null);

  // Modal 打開時載入帳號清單，並自動選第一個帳號當預設
  useEffect(() => {
    if (!opened) return;
    window.puffin.accounts.list().then((list) => {
      setAccounts(list);
      const firstYT = list.find((a) => a.platform === 'youtube');
      const firstFB = list.find((a) => a.platform === 'facebook');
      const firstIG = list.find((a) => a.platform === 'instagram');
      setTargetYouTube(firstYT ? String(firstYT.id) : null);
      setTargetFacebook(firstFB ? String(firstFB.id) : null);
      setTargetInstagram(firstIG ? String(firstIG.id) : null);
    }).catch((e) => {
      console.warn('load accounts failed', e);
    });
  }, [opened]);

  const ytAccounts = useMemo(() => accounts.filter((a) => a.platform === 'youtube'), [accounts]);
  const fbAccounts = useMemo(() => accounts.filter((a) => a.platform === 'facebook'), [accounts]);
  const igAccounts = useMemo(() => accounts.filter((a) => a.platform === 'instagram'), [accounts]);

  // 每筆可個別覆寫的標題
  const [titleOverrides, setTitleOverrides] = useState<Record<string, string>>({});

  const intervalMs = (intervalHours * 60 + intervalMinutes) * 60 * 1000;

  /** 計算第 idx 支影片的排程時間（基於 scheduleMode）*/
  const computeScheduledAt = (idx: number): number => {
    if (scheduleMode === 'interval') {
      return startAt.getTime() + idx * intervalMs;
    }
    // daily 模式：每天 postsPerDay 支，依 dailyTimes[slotIdx] 時段排
    const N = Math.max(1, postsPerDay);
    const groupIdx = Math.floor(idx / N); // 第幾天
    const slotIdx = idx % N; // 該天第幾個時段
    const slotTime = dailyTimes[slotIdx] ?? '20:00';
    const [hStr, mStr] = slotTime.split(':');
    const hour = parseInt(hStr ?? '20', 10);
    const minute = parseInt(mStr ?? '0', 10);

    const d = new Date(dailyStartDate);
    d.setHours(0, 0, 0, 0);

    // 推進 groupIdx 個 daysGap，含跳週末
    for (let i = 0; i < groupIdx; i++) {
      d.setDate(d.getDate() + daysGap);
      if (skipWeekends) {
        while (d.getDay() === 0 || d.getDay() === 6) {
          d.setDate(d.getDate() + 1);
        }
      }
    }
    // 起始日若也是週末且勾跳週末 → 推到下個工作日
    if (skipWeekends && groupIdx === 0) {
      while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() + 1);
      }
    }

    d.setHours(hour, minute, 0, 0);
    return d.getTime();
  };

  // 計算每支影片排程時間
  const computedRows = useMemo<BulkScheduleRow[]>(() => {
    return files.map((file, idx) => {
      // 用標題模板替換 {檔名}（檔名自動去副檔名）
      const baseTitle = substituteTitleFilename(titleTemplate, file.name);
      const title = titleOverrides[file.path] ?? baseTitle;
      const scheduledAt = computeScheduledAt(idx);
      const errors: string[] = [];
      const warnings: string[] = [];
      if (!title.trim()) errors.push('title 必填');
      if (scheduledAt < Date.now()) warnings.push('時間在過去，會立即觸發');
      if (platforms.length === 0) errors.push('platforms 必填');
      // v0.2.9：缺帳號則 fail（避免 fallback 到錯帳號）
      if (platforms.includes('youtube') && !targetYouTube) {
        errors.push('YouTube 未選擇帳號');
      }
      if (platforms.includes('facebook') && !targetFacebook) {
        errors.push('Facebook 未選擇帳號');
      }
      if (platforms.includes('instagram') && !targetInstagram) {
        errors.push('Instagram 未選擇帳號');
      }
      return {
        rowIndex: idx + 1,
        videoPath: file.path,
        title,
        description,
        hashtags,
        scheduledAt,
        platforms,
        privacy,
        targetAccounts: {
          ...(targetYouTube ? { youtube: parseInt(targetYouTube, 10) } : {}),
          ...(targetFacebook ? { facebook: parseInt(targetFacebook, 10) } : {}),
          ...(targetInstagram ? { instagram: parseInt(targetInstagram, 10) } : {})
        },
        errors,
        warnings
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    files,
    titleOverrides,
    scheduleMode,
    startAt,
    intervalMs,
    dailyStartDate,
    dailyTimes,
    postsPerDay,
    daysGap,
    skipWeekends,
    platforms,
    privacy,
    description,
    hashtags,
    titleTemplate,
    targetYouTube,
    targetFacebook,
    targetInstagram
  ]);

  const validCount = computedRows.filter((r) => r.errors.length === 0).length;
  const errorCount = computedRows.length - validCount;

  const resetState = () => {
    setFiles([]);
    setFolderPath('');
    setTitleOverrides({});
  };

  const handleFolderPicked = async (path: string) => {
    setScanning(true);
    try {
      const result = await window.puffin.schedule.scanFolder(path);
      setFolderPath(result.folderPath);
      setFiles(result.files);
      setTitleOverrides({});
      if (result.files.length === 0) {
        notifications.show({
          title: '沒找到影片檔',
          message: `「${result.folderPath}」內沒有 MP4 / MOV / WebM / MKV 等影片`,
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
    if (path) await handleFolderPicked(path);
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
        message: '請改用下方「選擇資料夾」按鈕',
        color: 'mango'
      });
      return;
    }
    await handleFolderPicked(path);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const validRows = computedRows.filter((r) => r.errors.length === 0);
      const ids = await window.puffin.schedule.bulkCreate(validRows);
      notifications.show({
        title: '批量匯入完成',
        message: `成功建立 ${ids.length} 筆排程${errorCount > 0 ? `（略過 ${errorCount} 筆錯誤）` : ''}`,
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

  const togglePlatform = (p: 'youtube' | 'facebook' | 'instagram') => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="批量匯入排程（資料夾模式）"
      size="92%"
      radius="xl"
    >
      <Stack gap="md">
        {/* Step 1：選/拖資料夾 */}
        {files.length === 0 && (
          <Box
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFolderDrop}
            style={{
              backgroundColor: isDragOver ? '#E2F5EC' : '#FFFFFF',
              borderColor: isDragOver ? '#6FBF9D' : '#B8E0D2',
              borderWidth: 2,
              borderStyle: 'dashed',
              borderRadius: 18,
              padding: 40,
              textAlign: 'center'
            }}
          >
            <Stack align="center" gap="md">
              <IconFolder size={64} color={isDragOver ? '#6FBF9D' : '#B8E0D2'} stroke={1.5} />
              <div>
                <Text size="lg" fw={700}>
                  {isDragOver ? '放手吧 🐧' : '拖一整個資料夾到這裡'}
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  自動抓 .mp4 / .mov / .webm / .mkv / .m4v / .avi
                </Text>
              </div>
              <Button
                color="mint"
                onClick={handlePickFolder}
                loading={scanning}
                leftSection={<IconFolder size={18} />}
              >
                選擇資料夾
              </Button>
            </Stack>
          </Box>
        )}

        {/* Step 2+3：全域預設 + 預覽 */}
        {files.length > 0 && (
          <>
            <Card padding="md">
              <Group justify="space-between" mb="sm">
                <Group gap="sm">
                  <IconFolder size={20} color="#B8E0D2" />
                  <div>
                    <Text fw={600} size="sm">{folderPath}</Text>
                    <Text size="xs" c="dimmed">{files.length} 個影片檔</Text>
                  </div>
                </Group>
                <Button variant="subtle" color="walnut" size="xs" onClick={resetState}>
                  換另一個資料夾
                </Button>
              </Group>
            </Card>

            {/* v0.6.7：套用範本 */}
            <Card padding="sm" withBorder>
              <TemplateApplyBar
                mode="video-reels"
                onApply={(t) => {
                  if (t.titleTemplate) setTitleTemplate(t.titleTemplate);
                  if (t.description !== null && t.description !== undefined) setDescription(t.description);
                  if (t.hashtags !== null && t.hashtags !== undefined) setHashtags(t.hashtags);
                  if (t.privacy === 'public' || t.privacy === 'private') setPrivacy(t.privacy);
                }}
                getCurrentSnapshot={() => ({
                  titleTemplate: titleTemplate || null,
                  description: description || null,
                  hashtags: hashtags || null,
                  privacy: privacy || null
                })}
              />
            </Card>

            <Card padding="md">
              <Stack gap="md">
                <Text fw={600} c="walnut.8">全域預設</Text>

                <Radio.Group
                  label="排程模式"
                  value={scheduleMode}
                  onChange={(v) => setScheduleMode(v as 'interval' | 'daily')}
                >
                  <Group mt={4}>
                    <Radio value="daily" label="每日定時（每天固定時間發一支）" color="lavender" />
                    <Radio value="interval" label="間隔模式（第一支起算每 X 小時）" color="mint" />
                  </Group>
                </Radio.Group>

                {scheduleMode === 'interval' ? (
                  <Group grow>
                    <DateTimePicker
                      label="第一支發送時間"
                      value={startAt}
                      onChange={(v) => v && setStartAt(new Date(v as unknown as string | Date))}
                      minDate={new Date()}
                      radius="md"
                      leftSection={<IconCalendarTime size={16} />}
                    />
                    <Group grow>
                      <NumberInput
                        label="間隔（小時）"
                        value={intervalHours}
                        onChange={(v) => setIntervalHours(typeof v === 'number' ? v : 0)}
                        min={0}
                        max={720}
                        radius="md"
                      />
                      <NumberInput
                        label="間隔（分鐘）"
                        value={intervalMinutes}
                        onChange={(v) => setIntervalMinutes(typeof v === 'number' ? v : 0)}
                        min={0}
                        max={59}
                        radius="md"
                      />
                    </Group>
                  </Group>
                ) : (
                  <Stack gap="sm">
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
                      <NumberInput
                        label="每 N 天一組"
                        description="例：1 = 每天、3 = 每三天、7 = 每週同一天"
                        value={daysGap}
                        onChange={(v) => setDaysGap(typeof v === 'number' && v > 0 ? v : 1)}
                        min={1}
                        max={30}
                        radius="md"
                      />
                    </Group>

                    <div>
                      <Text size="sm" mb={6}>每天發幾支（1–3）</Text>
                      <SegmentedControl
                        value={String(postsPerDay)}
                        onChange={(v) => setPostsPerDay(parseInt(v, 10))}
                        color="lavender"
                        radius="lg"
                        data={[
                          { value: '1', label: '1 支 / 天' },
                          { value: '2', label: '2 支 / 天' },
                          { value: '3', label: '3 支 / 天' }
                        ]}
                      />
                    </div>

                    <Group grow>
                      {Array.from({ length: postsPerDay }).map((_, slotIdx) => (
                        <TimeInput
                          key={slotIdx}
                          label={`第 ${slotIdx + 1} 個時段`}
                          value={dailyTimes[slotIdx] ?? '20:00'}
                          onChange={(e) => updateDailyTime(slotIdx, e.currentTarget.value)}
                          radius="md"
                          leftSection={<IconClock size={16} />}
                        />
                      ))}
                    </Group>

                    <Checkbox
                      label="跳過週六日（同一組的所有時段也會一起跳）"
                      checked={skipWeekends}
                      onChange={(e) => setSkipWeekends(e.currentTarget.checked)}
                      color="mint"
                    />

                    <Text size="xs" c="dimmed">
                      共 {files.length} 支影片，依排程會分到 {Math.ceil(files.length / postsPerDay)} 個發布日。
                      第 1 支發於 {dailyTimes[0]}、第 2 支發於 {dailyTimes[1] ?? '—'}、第 3 支發於 {dailyTimes[2] ?? '—'}（同一天內依序）。
                    </Text>
                  </Stack>
                )}

                <div>
                  <Text size="sm" mb={6}>發布平台</Text>
                  <Group gap="sm">
                    {(['youtube', 'facebook', 'instagram'] as const).map((p) => {
                      const meta = PLATFORM_ICON[p];
                      const Icon = meta.icon;
                      const enabled = platforms.includes(p);
                      return (
                        <Checkbox
                          key={p}
                          checked={enabled}
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

                {/* v0.2.9：每平台選目標帳號（整批用同一帳號）*/}
                <div>
                  <Text size="sm" mb={6} fw={600} c="walnut.7">
                    目標帳號（整批 {files.length} 支影片發到下列帳號）
                  </Text>
                  <Stack gap="xs">
                    {platforms.includes('youtube') && (
                      <Select
                        label={
                          <Group gap={4}>
                            <IconBrandYoutube size={14} color="#FF0000" />
                            <Text size="xs">YouTube 頻道</Text>
                          </Group>
                        }
                        placeholder={ytAccounts.length === 0 ? '請先到「帳號」頁連結 YouTube' : '選擇頻道'}
                        value={targetYouTube}
                        onChange={setTargetYouTube}
                        data={ytAccounts.map((a) => ({
                          value: String(a.id),
                          label: a.displayName
                        }))}
                        disabled={ytAccounts.length === 0}
                        radius="md"
                        size="xs"
                      />
                    )}
                    {platforms.includes('facebook') && (
                      <Select
                        label={
                          <Group gap={4}>
                            <IconBrandFacebook size={14} color="#1877F2" />
                            <Text size="xs">Facebook 粉專</Text>
                          </Group>
                        }
                        placeholder={fbAccounts.length === 0 ? '請先到「帳號」頁連結 Facebook' : '選擇粉專'}
                        value={targetFacebook}
                        onChange={setTargetFacebook}
                        data={fbAccounts.map((a) => ({
                          value: String(a.id),
                          label: a.displayName
                        }))}
                        disabled={fbAccounts.length === 0}
                        radius="md"
                        size="xs"
                      />
                    )}
                    {platforms.includes('instagram') && (
                      <Select
                        label={
                          <Group gap={4}>
                            <IconBrandInstagram size={14} color="#E4405F" />
                            <Text size="xs">Instagram 帳號</Text>
                          </Group>
                        }
                        placeholder={igAccounts.length === 0 ? '請先到「帳號」頁連結 Instagram' : '選擇 IG 帳號'}
                        value={targetInstagram}
                        onChange={setTargetInstagram}
                        data={igAccounts.map((a) => ({
                          value: String(a.id),
                          label: a.displayName
                        }))}
                        disabled={igAccounts.length === 0}
                        radius="md"
                        size="xs"
                      />
                    )}
                  </Stack>
                  <Text size="xs" c="dimmed" mt={6}>
                    💡 想為同一支影片分散到多個客戶帳號？v0.3.0 的圖文模式 CSV 可逐篇指定。
                  </Text>
                </div>

                <Radio.Group
                  value={privacy}
                  onChange={(v) => setPrivacy(v as 'public' | 'private')}
                  label="預設隱私（僅 YouTube 套用）"
                >
                  <Group mt={4}>
                    <Radio value="public" label="公開" color="mint" />
                    <Radio value="private" label="不公開" color="mint" />
                  </Group>
                </Radio.Group>

                <TextInput
                  label="標題模板"
                  description="用 {檔名} 表示要插入影片檔名（自動去副檔名）。預設套用品牌模板"
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.currentTarget.value)}
                />

                <Textarea
                  label="共通描述"
                  placeholder="所有影片共用的描述..."
                  value={description}
                  onChange={(e) => setDescription(e.currentTarget.value)}
                  autosize
                  minRows={2}
                  maxRows={4}
                />

                <TextInput
                  label="共通 Hashtag"
                  placeholder="#shorts #fyp"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.currentTarget.value)}
                />
              </Stack>
            </Card>

            <Divider />

            <Group justify="space-between">
              <Text size="sm" fw={600}>
                預覽 {computedRows.length} 筆 ·{' '}
                <Text component="span" c="mint.7">{validCount} 有效</Text>
                {errorCount > 0 && (
                  <>
                    {' / '}
                    <Text component="span" c="red.7">{errorCount} 有錯誤（會略過）</Text>
                  </>
                )}
              </Text>
              <Button
                color="lavender"
                onClick={handleImport}
                loading={importing}
                disabled={validCount === 0}
                leftSection={<IconCalendarTime size={16} />}
              >
                建立 {validCount} 筆排程
              </Button>
            </Group>

            <ScrollArea h={400}>
              <Table verticalSpacing="xs" striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>狀態</Table.Th>
                    <Table.Th>檔案</Table.Th>
                    <Table.Th>標題（可改）</Table.Th>
                    <Table.Th>時間</Table.Th>
                    <Table.Th>問題</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {computedRows.map((row, idx) => {
                    const file = files[idx];
                    return (
                      <Table.Tr key={file.path}>
                        <Table.Td>{row.rowIndex}</Table.Td>
                        <Table.Td>
                          {row.errors.length > 0 ? (
                            <Badge color="red" variant="light" size="sm">
                              ✕ 錯誤
                            </Badge>
                          ) : row.warnings.length > 0 ? (
                            <Badge color="mango" variant="light" size="sm">
                              ⚠ 警告
                            </Badge>
                          ) : (
                            <Badge color="mint" variant="light" size="sm">
                              ✓ OK
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={0}>
                            <Text size="xs" lineClamp={1} style={{ maxWidth: 200 }}>
                              {file.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatSize(file.sizeBytes)}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            value={row.title}
                            onChange={(e) =>
                              setTitleOverrides((prev) => ({
                                ...prev,
                                [file.path]: e.currentTarget.value
                              }))
                            }
                            size="xs"
                            radius="sm"
                            style={{ minWidth: 240 }}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">{formatDateTime(row.scheduledAt)}</Text>
                          <Text size="xs" c="dimmed">
                            {timeUntil(row.scheduledAt)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {row.errors.length > 0 && (
                            <Text size="xs" c="red.7">{row.errors.join('；')}</Text>
                          )}
                          {row.warnings.length > 0 && (
                            <Text size="xs" c="mango.7">{row.warnings.join('；')}</Text>
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

interface EventDetailModalProps {
  post: PostRecord | null;
  onClose: () => void;
  onCancel: (id: number) => void;
}

function EventDetailModal({ post, onClose, onCancel }: EventDetailModalProps) {
  const [previewOpened, setPreviewOpened] = useState(false);
  if (!post) return null;
  const platforms = getEnabledPlatforms(post);
  return (
    <Modal opened onClose={onClose} title="排程細節" radius="xl" size="md">
      <Stack gap="md">
        <Group gap="md" wrap="nowrap" align="flex-start">
          <Avatar
            src={toMediaUrl(post.thumbnailPath)}
            radius="md"
            size={64}
            style={{ cursor: post.filePath ? 'pointer' : 'default' }}
            onClick={() => {
              if (post.filePath) setPreviewOpened(true);
            }}
          >
            {post.title[0] ?? '?'}
          </Avatar>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text fw={700}>{post.title}</Text>
            <Text size="xs" c="dimmed" mt={2}>
              {post.fileName}
            </Text>
            <Group gap={6} mt={6}>
              <Badge color="lavender" variant="light" leftSection={<IconCalendarTime size={12} />}>
                {post.scheduledAt ? formatDateTime(post.scheduledAt) : '—'}
              </Badge>
              <Badge color="walnut" variant="light">
                {post.scheduledAt ? timeUntil(post.scheduledAt) : '—'}
              </Badge>
            </Group>
            <Group gap={6} mt={6}>
              {platforms.map((p) => {
                const meta = PLATFORM_ICON[p];
                const Icon = meta.icon;
                return (
                  <Badge key={p} variant="light" color="walnut" leftSection={<Icon size={12} color={meta.color} />}>
                    {meta.name}
                  </Badge>
                );
              })}
            </Group>
          </div>
        </Group>

        {post.description && (
          <div>
            <Text size="xs" c="dimmed" mb={2}>描述</Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{post.description}</Text>
          </div>
        )}

        {post.hashtags && (
          <div>
            <Text size="xs" c="dimmed" mb={2}>Hashtag</Text>
            <Text size="sm" c="sky.7">{post.hashtags}</Text>
          </div>
        )}

        <Divider />

        <Group justify="flex-end">
          <Button variant="subtle" color="walnut" onClick={onClose}>
            關閉
          </Button>
          <Button
            color="red"
            variant="light"
            leftSection={<IconTrash size={16} />}
            onClick={() => {
              onCancel(post.id);
              onClose();
            }}
          >
            取消此排程
          </Button>
        </Group>
      </Stack>

      <VideoPreviewModal
        opened={previewOpened}
        onClose={() => setPreviewOpened(false)}
        filePath={post.filePath}
        fileName={post.fileName}
        thumbnailPath={post.thumbnailPath}
      />
    </Modal>
  );
}

export function SchedulePage() {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [importModalOpened, setImportModalOpened] = useState(false);
  const [imageImportModalOpened, setImageImportModalOpened] = useState(false);
  const [watchersModalOpened, setWatchersModalOpened] = useState(false);
  const [autoLaunch, setAutoLaunchState] = useState(false);
  const [view, setView] = useState<View>(Views.MONTH);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [openedPost, setOpenedPost] = useState<PostRecord | null>(null);
  const [cancelAllConfirmOpened, setCancelAllConfirmOpened] = useState(false);
  const [cancelAllBusy, setCancelAllBusy] = useState(false);

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return posts
      .filter((p) => p.scheduledAt)
      .map((post) => ({
        id: post.id,
        title: post.title,
        start: new Date(post.scheduledAt as number),
        end: new Date((post.scheduledAt as number) + 30 * 60 * 1000),
        resource: post
      }));
  }, [posts]);

  const refresh = useCallback(async () => {
    try {
      const list = await window.puffin.schedule.list();
      setPosts(list);
    } catch (e) {
      console.error('load scheduled posts failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  // 載入自動啟動狀態（用來顯示 Alert 顏色）
  useEffect(() => {
    window.puffin.system.getAutoLaunch().then(setAutoLaunchState).catch(() => {});
    const t = setInterval(() => {
      window.puffin.system.getAutoLaunch().then(setAutoLaunchState).catch(() => {});
    }, 10_000);
    return () => clearInterval(t);
  }, []);

  const handleCancel = async (id: number) => {
    try {
      await window.puffin.schedule.cancel(id);
      notifications.show({
        title: '已取消排程',
        message: '此排程已從佇列移除',
        color: 'mint'
      });
      await refresh();
    } catch (e) {
      notifications.show({
        title: '取消失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  const handleCancelAll = async () => {
    setCancelAllBusy(true);
    try {
      const count = await window.puffin.schedule.cancelAll();
      notifications.show({
        title: '已取消全部排程',
        message: `共取消 ${count} 筆排程`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
      await refresh();
    } catch (e) {
      notifications.show({
        title: '取消全部失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setCancelAllBusy(false);
      setCancelAllConfirmOpened(false);
    }
  };

  return (
    <Stack gap="lg" py="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} c="walnut.8">排程</Title>
          <Text c="dimmed" size="sm" mt={4}>
            指定時間自動發送，海鸚替你飛。
          </Text>
        </div>
        <Group>
          {loading && <Loader size="sm" color="mint" />}
          <Button
            color="lavender"
            leftSection={<IconFolder size={16} />}
            onClick={() => setImportModalOpened(true)}
          >
            批量影片
          </Button>
          <Button
            color="sakura"
            leftSection={<IconFolder size={16} />}
            onClick={() => setImageImportModalOpened(true)}
          >
            批量圖文
          </Button>
          <Button
            color="sky"
            variant="light"
            leftSection={<IconFolder size={16} />}
            onClick={() => setWatchersModalOpened(true)}
          >
            📂 監聽資料夾
          </Button>
          <Button
            color="red"
            variant="light"
            leftSection={<IconTrash size={16} />}
            onClick={() => setCancelAllConfirmOpened(true)}
            disabled={posts.length === 0}
          >
            取消全部排程
          </Button>
        </Group>
      </Group>

      <Alert
        color={autoLaunch ? 'mint' : 'mango'}
        variant="light"
        radius="lg"
        icon={<IconShieldCheck size={20} />}
        title={autoLaunch ? '排程容錯保護已啟用' : '排程容錯保護未啟用'}
      >
        <Stack gap="xs">
          <Text size="sm">
            ✓ 所有排程都立即落盤到 SQLite，不怕意外關機<br />
            ✓ App 重啟時會自動恢復被中斷的紀錄、補發錯過的排程<br />
            {autoLaunch ? (
              <>✓ 電腦開機時 PuffinPuff 自動啟動，24/7 排程不錯過</>
            ) : (
              <>⚠ 「電腦開機自動啟動」目前未啟用 — 至「設定」→「排程容錯」打開以避免錯過排程</>
            )}
          </Text>
        </Stack>
      </Alert>

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{ height: 720 }}>
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            messages={CALENDAR_MESSAGES}
            culture="zh-tw"
            views={[Views.DAY, Views.WEEK, Views.MONTH]}
            view={view}
            onView={(v) => setView(v)}
            date={calendarDate}
            onNavigate={(d) => setCalendarDate(d)}
            defaultView={Views.MONTH}
            popup
            step={30}
            timeslots={2}
            min={dayjs().hour(6).minute(0).toDate()}
            max={dayjs().hour(23).minute(59).toDate()}
            formats={{
              monthHeaderFormat: 'YYYY 年 M 月',
              dayHeaderFormat: 'M 月 D 日（dddd）',
              dayRangeHeaderFormat: ({ start, end }) =>
                `${dayjs(start).format('M/D')} – ${dayjs(end).format('M/D')}`,
              timeGutterFormat: 'HH:mm',
              eventTimeRangeFormat: ({ start }) => dayjs(start).format('HH:mm'),
              agendaTimeFormat: 'HH:mm',
              agendaDateFormat: 'M/D ddd'
            }}
            onSelectEvent={(e) => setOpenedPost(e.resource)}
            eventPropGetter={(event) => {
              const platforms = getEnabledPlatforms(event.resource);
              // 三個平台一起發 → 紫；少於 3 個 → 淡紫；只有 1 個 → 灰紫
              const intensity = platforms.length;
              return {
                style: {
                  backgroundColor:
                    intensity === 3 ? '#D8C6E8' : intensity === 2 ? '#E6DAEE' : '#F0E8F5'
                }
              };
            }}
          />
        </div>
      </Card>

      {posts.length === 0 && !loading && (
        <Card>
          <Center py="lg">
            <Stack align="center" gap="md">
              <IconCalendarEvent size={48} color="#D8C6E8" stroke={1.5} />
              <Text c="dimmed" ta="center" maw={420} size="sm">
                還沒有排程。到「發布」頁選「排程於特定時間」加入，或上方「批量匯入資料夾」。
              </Text>
            </Stack>
          </Center>
        </Card>
      )}

      <EventDetailModal
        post={openedPost}
        onClose={() => setOpenedPost(null)}
        onCancel={handleCancel}
      />

      <BulkImportModal
        opened={importModalOpened}
        onClose={() => setImportModalOpened(false)}
        onImported={refresh}
      />

      <ImagePostBulkModal
        opened={imageImportModalOpened}
        onClose={() => setImageImportModalOpened(false)}
        onImported={refresh}
      />

      <WatchersModal
        opened={watchersModalOpened}
        onClose={() => {
          setWatchersModalOpened(false);
          refresh();
        }}
      />

      <Modal
        opened={cancelAllConfirmOpened}
        onClose={() => !cancelAllBusy && setCancelAllConfirmOpened(false)}
        title="確認取消全部排程"
        radius="xl"
        size="sm"
        closeOnClickOutside={!cancelAllBusy}
        closeOnEscape={!cancelAllBusy}
      >
        <Stack gap="md">
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {`將取消目前所有 ${posts.length} 筆排程（從 scheduler 移除 + 從資料庫刪除）。\n\n已發布過的歷史紀錄、影片原檔、帳號授權都會保留。\n\n此動作無法復原。`}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="subtle"
              color="walnut"
              onClick={() => setCancelAllConfirmOpened(false)}
              disabled={cancelAllBusy}
            >
              不要
            </Button>
            <Button color="red" onClick={handleCancelAll} loading={cancelAllBusy}>
              全部取消
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
