import { useEffect, useState } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Badge,
  Group,
  Button,
  SimpleGrid,
  Box,
  Tooltip,
  ActionIcon,
  Radio,
  UnstyledButton
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconVideo,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconBrandYoutube,
  IconBrandFacebook,
  IconBrandInstagram,
  IconTrash,
  IconDeviceFloppy,
  IconCalendarTime,
  type Icon
} from '@tabler/icons-react';
import { NativeDropzone } from '../components/NativeDropzone';
import type {
  PlatformValidation,
  ProbedMedia,
  PublishContent,
  PublishJobState,
  VideoSpec
} from '../../../shared/types';
import { DEFAULT_PUBLISH_CONTENT, substituteTitleFilename } from '../../../shared/types';
import { ContentEditor } from '../components/ContentEditor';
import { PublishProgress } from '../components/PublishProgress';
import { TemplateApplyBar } from '../components/TemplateApplyBar';
import type { ContentTemplate } from '../../../shared/types';

const PLATFORM_ICONS: Record<PlatformValidation['platform'], { icon: Icon; color: string; label: string }> = {
  youtube: { icon: IconBrandYoutube, color: '#FF0000', label: 'YouTube' },
  facebook: { icon: IconBrandFacebook, color: '#1877F2', label: 'Facebook' },
  instagram: { icon: IconBrandInstagram, color: '#E4405F', label: 'Instagram' }
};

function toMediaUrl(filePath: string): string {
  // Windows 路徑 C:\... → 編碼成 puffin-media:///C:/...
  const normalized = filePath.replace(/\\/g, '/');
  return `puffin-media:///${encodeURI(normalized)}`;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function VideoSpecRow({ spec }: { spec: VideoSpec }) {
  return (
    <Group gap="md" wrap="wrap">
      <Badge variant="light" color="walnut" size="md">
        {spec.width}×{spec.height}
      </Badge>
      <Badge variant="light" color="walnut" size="md">
        比例 {spec.aspectRatio}
      </Badge>
      <Badge variant="light" color="walnut" size="md">
        {formatDuration(spec.durationSec)}
      </Badge>
      <Badge variant="light" color="walnut" size="md">
        {spec.fps.toFixed(0)} fps
      </Badge>
      <Badge variant="light" color="walnut" size="md">
        {spec.codec}
      </Badge>
      <Badge variant="light" color="walnut" size="md">
        {formatSize(spec.fileSizeBytes)}
      </Badge>
      {!spec.hasAudio && (
        <Badge variant="light" color="mango" size="md">無音軌</Badge>
      )}
    </Group>
  );
}

function ValidationCard({ v }: { v: PlatformValidation }) {
  const meta = PLATFORM_ICONS[v.platform];
  const Icon = meta.icon;
  let status: { color: string; label: string; icon: Icon; tone: string } = {
    color: 'mint',
    label: '規格符合，用原檔',
    icon: IconCheck,
    tone: 'light'
  };
  const hardViolation = v.reasons.some((r) => r.includes('時長') || r.includes('大小'));
  if (hardViolation) {
    status = {
      color: 'red',
      label: '無法上傳',
      icon: IconAlertTriangle,
      tone: 'light'
    };
  } else if (v.needsTranscode) {
    status = {
      color: 'mango',
      label: '將自動轉檔 1080×1920 30fps',
      icon: IconAlertTriangle,
      tone: 'light'
    };
  }
  const StatusIcon = status.icon;
  return (
    <Card padding="md">
      <Group gap="sm" mb="xs">
        <Icon size={20} color={meta.color} />
        <Text fw={600}>{meta.label}</Text>
      </Group>
      <Badge color={status.color} variant={status.tone} leftSection={<StatusIcon size={12} />}>
        {status.label}
      </Badge>
      {v.reasons.length > 0 && (
        <Stack gap={2} mt="xs">
          {v.reasons.map((r, i) => (
            <Text key={i} size="xs" c="dimmed">• {r}</Text>
          ))}
        </Stack>
      )}
    </Card>
  );
}

interface PublishPageProps {
  draftIdToLoad?: number | null;
  onDraftLoaded?: () => void;
}

type ContentMode = 'video-reels' | 'image-post' | 'carousel';

export function PublishPage({ draftIdToLoad, onDraftLoaded }: PublishPageProps = {}) {
  const [media, setMedia] = useState<ProbedMedia | null>(null);
  const [probing, setProbing] = useState(false);
  const [content, setContent] = useState<PublishContent>(DEFAULT_PUBLISH_CONTENT);
  const [activeJob, setActiveJob] = useState<PublishJobState | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMode, setPublishMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  // v0.6.3：發布內容模式（影片 Reels / 單圖貼文 / 多圖 Carousel）
  const [contentMode, setContentMode] = useState<ContentMode>('video-reels');

  // 當 App 傳入 draftIdToLoad 時，載入該草稿的內容與媒體
  useEffect(() => {
    if (draftIdToLoad === null || draftIdToLoad === undefined) return;
    (async () => {
      try {
        const post = await window.puffin.posts.get(draftIdToLoad);
        if (!post) {
          notifications.show({
            title: '草稿不存在',
            message: '可能已被刪除',
            color: 'mango'
          });
          onDraftLoaded?.();
          return;
        }
        if (post.contentJson) {
          setContent(JSON.parse(post.contentJson));
        }
        if (post.filePath) {
          setProbing(true);
          try {
            const probed = await window.puffin.media.probe(post.filePath);
            setMedia(probed);
          } catch (e) {
            notifications.show({
              title: '影片檔讀取失敗',
              message: `草稿存的路徑可能已不存在：${(e as Error).message}`,
              color: 'mango',
              icon: <IconAlertTriangle size={18} />
            });
          } finally {
            setProbing(false);
          }
        }
        // 草稿載回後刪除，避免重複（用戶可在發布前再存草稿）
        await window.puffin.posts.delete(draftIdToLoad);
        notifications.show({
          title: '草稿已載回',
          message: '繼續編輯後可重新發布或存為新草稿',
          color: 'mint',
          icon: <IconCheck size={18} />
        });
      } catch (e) {
        notifications.show({
          title: '草稿載入失敗',
          message: (e as Error).message,
          color: 'red'
        });
      } finally {
        onDraftLoaded?.();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftIdToLoad]);

  // 訂閱 publish:progress 事件，更新 activeJob
  useEffect(() => {
    const unsubscribe = window.puffin.publish.onProgress((evt) => {
      setActiveJob((prev) => {
        if (prev && prev.jobId !== evt.jobId) return prev; // 忽略不是當前 job
        return evt.state;
      });
    });
    return unsubscribe;
  }, []);

  const probeAndShow = async (filePath: string) => {
    setProbing(true);
    try {
      const result = await window.puffin.media.probe(filePath);
      setMedia(result);
      // 若標題仍含 {檔名} placeholder，立刻替換為實際檔名
      setContent((c) => {
        if (!c.common.title.includes('{檔名}')) return c;
        return {
          ...c,
          common: {
            ...c.common,
            title: substituteTitleFilename(c.common.title, result.spec.fileName)
          }
        };
      });
    } catch (e) {
      notifications.show({
        title: '媒體讀取失敗',
        message: (e as Error).message,
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    } finally {
      setProbing(false);
    }
  };

  const handleDropError = (message: string) => {
    notifications.show({
      title: '拖拉檔案失敗',
      message,
      color: 'mango',
      icon: <IconAlertTriangle size={18} />
    });
  };

  const handlePickFile = async () => {
    const filePath = await window.puffin.media.openFileDialog();
    if (!filePath) return;
    await probeAndShow(filePath);
  };

  const handlePublish = async () => {
    if (!media) return;
    setPublishing(true);
    try {
      // v0.6.3：顯式傳 postType 對應 UI 選的 mode
      //   (backend v0.6.0 還是會再用副檔名驗證一次，雙重保險)
      const postTypeForBackend: 'video' | 'image' | 'carousel' =
        contentMode === 'video-reels' ? 'video' :
          contentMode === 'carousel' ? 'carousel' : 'image';
      const jobId = await window.puffin.publish.start({
        filePath: media.spec.filePath,
        fileName: media.spec.fileName,
        thumbnailPath: media.thumbnailPath,
        content,
        postType: postTypeForBackend
      });
      // 立即用 placeholder 顯示 UI（progress 事件會立刻覆寫）
      setActiveJob({
        jobId,
        filePath: media.spec.filePath,
        platforms: [],
        overallStatus: 'running',
        startedAt: Date.now()
      });
    } catch (e) {
      notifications.show({
        title: '發布啟動失敗',
        message: (e as Error).message,
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;
    await window.puffin.publish.cancel(activeJob.jobId);
  };

  const handleResetAfterPublish = () => {
    setActiveJob(null);
    setMedia(null);
    setContent(DEFAULT_PUBLISH_CONTENT);
  };

  const handleSchedule = async () => {
    if (!media || !scheduledAt) return;
    setPublishing(true);
    try {
      const postId = await window.puffin.schedule.create({
        filePath: media.spec.filePath,
        fileName: media.spec.fileName,
        thumbnailPath: media.thumbnailPath,
        content,
        scheduledAt: scheduledAt.getTime()
      });
      notifications.show({
        title: '已加入排程',
        message: `排程 #${postId} 將於 ${scheduledAt.toLocaleString('zh-TW')} 自動發布`,
        color: 'lavender',
        icon: <IconCalendarTime size={18} />
      });
      // 重設整個畫面
      setMedia(null);
      setContent(DEFAULT_PUBLISH_CONTENT);
      setScheduledAt(null);
      setPublishMode('immediate');
    } catch (e) {
      notifications.show({
        title: '排程失敗',
        message: (e as Error).message,
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      const id = await window.puffin.posts.saveDraft({
        filePath: media?.spec.filePath ?? null,
        fileName: media?.spec.fileName ?? null,
        thumbnailPath: media?.thumbnailPath ?? null,
        content
      });
      notifications.show({
        title: '草稿已儲存',
        message: `紀錄 #${id} 已存入歷史頁的「草稿」分類`,
        color: 'mint',
        icon: <IconCheck size={18} />
      });
    } catch (e) {
      notifications.show({
        title: '存草稿失敗',
        message: (e as Error).message,
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    }
  };

  // 訂閱「Ctrl+O 開啟檔案」快捷鍵
  useEffect(() => {
    const unsubscribe = window.puffin.shortcuts.onOpenFile(() => {
      handlePickFile();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = () => {
    setMedia(null);
  };

  // v0.6.3：mode 顯示資訊
  const modeInfo: Record<ContentMode, { label: string; desc: string; color: string; emoji: string }> = {
    'video-reels': { label: '影片 Reels', desc: '單支直立 9:16 影片 → YT Shorts + FB/IG Reels', color: 'sky', emoji: '🎬' },
    'image-post': { label: '單圖貼文', desc: '單張圖 → FB Photo + IG Single Image（無 YT）', color: 'mango', emoji: '🖼' },
    'carousel': { label: '多圖 Carousel', desc: '2-10 張圖 → FB MultiPhoto + IG Carousel（無 YT）', color: 'lavender', emoji: '🎠' }
  };
  const currentMode = modeInfo[contentMode];

  const handleModeChange = (newMode: ContentMode): void => {
    if (newMode === contentMode) return;
    // 切換 mode 時清空已選媒體（避免類型不對）
    if (media) {
      setMedia(null);
      setContent(DEFAULT_PUBLISH_CONTENT);
    }
    setContentMode(newMode);
  };

  return (
    <Stack gap="lg" py="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} c="walnut.8">發布</Title>
          <Text c="dimmed" size="sm" mt={4}>
            撲通一聲，內容飛上三平台。
          </Text>
        </div>
        <Badge variant="light" color={currentMode.color} size="lg" leftSection={<span>{currentMode.emoji}</span>}>
          {currentMode.label}
        </Badge>
      </Group>

      {/* v0.6.3：Mode 選擇器（影片 Reels / 單圖貼文 / 多圖 Carousel）*/}
      {!activeJob && (
        <Card padding="sm" withBorder>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={600}>選擇發布模式</Text>
            <SimpleGrid cols={3} spacing="xs">
              {(['video-reels', 'image-post', 'carousel'] as ContentMode[]).map((m) => {
                const info = modeInfo[m];
                const isActive = contentMode === m;
                return (
                  <UnstyledModeCard
                    key={m}
                    active={isActive}
                    color={info.color}
                    emoji={info.emoji}
                    label={info.label}
                    desc={info.desc}
                    onClick={() => handleModeChange(m)}
                  />
                );
              })}
            </SimpleGrid>
          </Stack>
        </Card>
      )}

      {activeJob && (
        <PublishProgress
          job={activeJob}
          onCancel={handleCancelJob}
          onReset={handleResetAfterPublish}
        />
      )}

      {!activeJob && !media && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed" ta="center">
            {contentMode === 'video-reels' && '拖入 .mp4 / .mov 影片檔（建議 9:16 直立、3-180 秒）'}
            {contentMode === 'image-post' && '拖入 .jpg / .png 單張圖（建議 1080×1080 以上）'}
            {contentMode === 'carousel' && '拖入第一張圖（.jpg/.png），稍後在編輯區補上其他 1-9 張'}
          </Text>
          <NativeDropzone
            onFilePath={probeAndShow}
            onDropError={handleDropError}
            onPickClick={handlePickFile}
            loading={probing}
          />
        </Stack>
      )}

      {!activeJob && media && (
        <Card>
          <Group justify="space-between" mb="md">
            <Group gap="sm">
              <IconVideo size={20} color="#6FBF9D" />
              <Text fw={600} c="walnut.8">{media.spec.fileName}</Text>
            </Group>
            <Tooltip label="移除，重新選檔">
              <ActionIcon variant="subtle" color="walnut" onClick={handleClear}>
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {media.spec.type === 'video' && (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              {/* 左欄：影片預覽 + HEVC 提示 */}
              <Stack gap="xs" align="center">
                <Box
                  style={{
                    backgroundColor: '#000',
                    borderRadius: 14,
                    overflow: 'hidden',
                    aspectRatio: '9/16',
                    maxHeight: 480,
                    width: '100%',
                    maxWidth: 270
                  }}
                >
                  <video
                    src={toMediaUrl(media.spec.filePath)}
                    poster={media.thumbnailPath ? toMediaUrl(media.thumbnailPath) : undefined}
                    controls
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Box>
                {media.spec.codec.toLowerCase() === 'hevc' && (
                  <Text size="xs" c="dimmed" ta="center" maw={280}>
                    ⓘ HEVC 編碼瀏覽器無法直接播放，預覽顯示縮圖；實際發布不受影響（YouTube/IG/FB 都支援 HEVC 上傳）
                  </Text>
                )}
              </Stack>

              {/* 右欄：規格與驗證 */}
              <Stack gap="md">
                <div>
                  <Text size="xs" c="dimmed" mb={4}>檔案資訊</Text>
                  <VideoSpecRow spec={media.spec} />
                </div>
                <div>
                  <Text size="xs" c="dimmed" mb={6}>平台規格驗證</Text>
                  <Stack gap="sm">
                    {media.validations.map((v) => (
                      <ValidationCard key={v.platform} v={v} />
                    ))}
                  </Stack>
                </div>
              </Stack>
            </SimpleGrid>
          )}

          {media.spec.type === 'image' && (
            <Stack gap="md">
              <Box
                style={{
                  backgroundColor: '#FBF7F2',
                  borderRadius: 14,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={toMediaUrl(media.spec.filePath)}
                  alt={media.spec.fileName}
                  style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 8 }}
                />
              </Box>
              <Group gap="md">
                <Badge variant="light">{media.spec.width}×{media.spec.height}</Badge>
                <Badge variant="light">{formatSize(media.spec.fileSizeBytes)}</Badge>
              </Group>
            </Stack>
          )}
        </Card>
      )}

      {/* v0.6.5：套用範本工具列 */}
      {!activeJob && media && (
        <Card padding="sm" withBorder>
          <TemplateApplyBar
            mode={contentMode}
            onApply={(t: ContentTemplate) => {
              // 把範本內容套到 content state
              const filename = media.spec.fileName ?? '';
              const filenameWithoutExt = filename.replace(/\.[^.]+$/, '');
              const newTitle = t.titleTemplate
                ? substituteTitleFilename(t.titleTemplate, filenameWithoutExt)
                : content.common.title;
              setContent({
                ...content,
                common: {
                  ...content.common,
                  title: newTitle || content.common.title,
                  description: t.description ?? content.common.description,
                  hashtags: t.hashtags ?? content.common.hashtags,
                  privacy: (t.privacy as PublishContent['common']['privacy']) ?? content.common.privacy
                }
              });
            }}
            getCurrentSnapshot={() => ({
              titleTemplate: content.common.title || null,
              description: content.common.description || null,
              hashtags: content.common.hashtags || null,
              privacy: content.common.privacy || null
            })}
          />
        </Card>
      )}

      {!activeJob && media && (
        <ContentEditor value={content} onChange={setContent} />
      )}

      {!activeJob && media && (
        <Card>
          <Stack gap="md">
            <Title order={5} c="walnut.8">發布時機</Title>
            <Radio.Group
              value={publishMode}
              onChange={(v) => setPublishMode(v as 'immediate' | 'scheduled')}
            >
              <Group gap="lg">
                <Radio value="immediate" label="立即發布" color="mint" />
                <Radio value="scheduled" label="排程於特定時間" color="lavender" />
              </Group>
            </Radio.Group>

            {publishMode === 'scheduled' && (
              <DateTimePicker
                label="發送時間"
                placeholder="點此選日期 + 時間"
                value={scheduledAt}
                onChange={(v) => setScheduledAt(v as unknown as Date | null)}
                minDate={new Date()}
                clearable
                radius="md"
                size="md"
                leftSection={<IconCalendarTime size={16} />}
              />
            )}
          </Stack>
        </Card>
      )}

      {!activeJob && media && (
        <Group justify="flex-end">
          <Button variant="subtle" color="walnut" onClick={handleClear} leftSection={<IconX size={16} />}>
            清除
          </Button>
          <Button
            variant="light"
            color="mango"
            onClick={handleSaveDraft}
            leftSection={<IconDeviceFloppy size={16} />}
          >
            存草稿
          </Button>
          {publishMode === 'immediate' ? (
            <Button
              color="sakura"
              size="lg"
              radius="xl"
              loading={publishing}
              onClick={handlePublish}
              disabled={!content.common.title || !Object.values(content.perPlatform).some((p) => p.enabled)}
            >
              🚀 發布
            </Button>
          ) : (
            <Button
              color="lavender"
              size="lg"
              radius="xl"
              loading={publishing}
              onClick={handleSchedule}
              leftSection={<IconCalendarTime size={18} />}
              disabled={
                !content.common.title ||
                !Object.values(content.perPlatform).some((p) => p.enabled) ||
                !scheduledAt
              }
            >
              加入排程
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}

interface UnstyledModeCardProps {
  active: boolean;
  color: string;
  emoji: string;
  label: string;
  desc: string;
  onClick: () => void;
}

function UnstyledModeCard({ active, color, emoji, label, desc, onClick }: UnstyledModeCardProps): JSX.Element {
  // 根據 color 對應 Mantine 顏色變數
  const accentBg: Record<string, string> = {
    sky: '#E1F1FA',
    mango: '#FFEED1',
    lavender: '#EDE3F5'
  };
  const accentBorder: Record<string, string> = {
    sky: '#5BA9D6',
    mango: '#E8A33D',
    lavender: '#8B6FB8'
  };
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        backgroundColor: active ? accentBg[color] ?? '#E2F5EC' : 'transparent',
        border: `2px solid ${active ? accentBorder[color] ?? '#6FBF9D' : '#E5DCD3'}`,
        transition: 'all 150ms ease',
        textAlign: 'left'
      }}
    >
      <Stack gap={4}>
        <Group gap="xs">
          <Text size="lg">{emoji}</Text>
          <Text size="sm" fw={active ? 700 : 500} c={active ? 'walnut.8' : 'walnut.7'}>
            {label}
          </Text>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={2}>{desc}</Text>
      </Stack>
    </UnstyledButton>
  );
}
