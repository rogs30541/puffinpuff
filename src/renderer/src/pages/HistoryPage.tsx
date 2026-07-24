import { useCallback, useEffect, useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Badge,
  Group,
  Card,
  Center,
  Loader,
  SegmentedControl,
  ActionIcon,
  Avatar,
  Anchor,
  Tooltip,
  Modal,
  Divider,
  Button
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconHistory,
  IconTrash,
  IconBrandYoutube,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandThreads,
  IconCheck,
  IconAlertTriangle,
  IconLoader,
  IconExternalLink,
  IconFileText,
  IconClock,
  IconRefresh,
  IconCalendarTime,
  IconEdit,
  IconCopy,
  type Icon
} from '@tabler/icons-react';
import type { PostRecord, PostStatus, PostTargetRecord, TargetStatus } from '../../../shared/types';
import { VideoPreviewModal } from '../components/VideoPreviewModal';

const PLATFORM_ICON: Record<
  'youtube' | 'facebook' | 'instagram' | 'threads',
  { icon: Icon; color: string; name: string }
> = {
  youtube: { icon: IconBrandYoutube, color: '#FF0000', name: 'YouTube' },
  facebook: { icon: IconBrandFacebook, color: '#1877F2', name: 'Facebook' },
  instagram: { icon: IconBrandInstagram, color: '#E4405F', name: 'Instagram' },
  threads: { icon: IconBrandThreads, color: '#000000', name: 'Threads' }
};

const TARGET_STATUS_COLOR: Record<TargetStatus, string> = {
  pending: 'walnut',
  success: 'mint',
  failed: 'red',
  cancelled: 'walnut'
};

const POST_STATUS_LABEL: Record<PostStatus, string> = {
  draft: '草稿',
  scheduled: '已排程',
  publishing: '發布中',
  completed: '全部成功',
  partial: '部分成功',
  failed: '失敗'
};

const POST_STATUS_COLOR: Record<PostStatus, string> = {
  draft: 'walnut',
  scheduled: 'lavender',
  publishing: 'mint',
  completed: 'mint',
  partial: 'mango',
  failed: 'red'
};

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toMediaUrl(filePath: string | null): string | undefined {
  if (!filePath) return undefined;
  return `puffin-media:///${encodeURI(filePath.replace(/\\/g, '/'))}`;
}

interface PostRowProps {
  post: PostRecord;
  onOpen: () => void;
  onDelete: () => void;
  onRepublish: () => void;
}

function PostRow({ post, onOpen, onDelete, onRepublish }: PostRowProps) {
  const canRepublish = post.status === 'failed' || post.status === 'partial';
  return (
    <Card
      onClick={onOpen}
      style={{ cursor: 'pointer' }}
    >
      <Group gap="md" wrap="nowrap" align="flex-start">
        <Avatar
          src={toMediaUrl(post.thumbnailPath)}
          radius="md"
          size={56}
          color="mint"
        >
          {post.title[0] ?? '?'}
        </Avatar>

        <div style={{ minWidth: 0, flex: 1 }}>
          <Group justify="space-between" mb={4}>
            <Text fw={600} lineClamp={1} style={{ flex: 1 }}>
              {post.title || '(未命名)'}
            </Text>
            <Badge color={POST_STATUS_COLOR[post.status]} variant="light" size="sm">
              {POST_STATUS_LABEL[post.status]}
            </Badge>
          </Group>

          <Group gap={6} mb={6}>
            <IconClock size={12} color="#7C736B" />
            <Text size="xs" c="dimmed">
              {formatDateTime(post.createdAt)}
            </Text>
            {post.fileName && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                · {post.fileName}
              </Text>
            )}
          </Group>

          <Group gap={4}>
            {post.targets.map((t) => {
              const meta = PLATFORM_ICON[t.platform];
              const PlatformIcon = meta.icon;
              const Status =
                t.status === 'success'
                  ? IconCheck
                  : t.status === 'failed'
                    ? IconAlertTriangle
                    : IconLoader;
              return (
                <Tooltip
                  key={t.platform}
                  label={`${meta.name}: ${t.status}${t.errorMessage ? ` — ${t.errorMessage}` : ''}`}
                >
                  <Badge
                    color={TARGET_STATUS_COLOR[t.status]}
                    variant="light"
                    leftSection={<PlatformIcon size={12} color={meta.color} />}
                    rightSection={<Status size={10} />}
                  >
                    {meta.name}
                  </Badge>
                </Tooltip>
              );
            })}
          </Group>
        </div>

        <Group gap={4}>
          {canRepublish && (
            <Tooltip label="重新發布失敗的平台">
              <ActionIcon
                variant="subtle"
                color="mint"
                onClick={(e) => {
                  e.stopPropagation();
                  onRepublish();
                }}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="刪除紀錄">
            <ActionIcon
              variant="subtle"
              color="walnut"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  );
}

function buildErrorMarkdown(post: PostRecord): string {
  const lines: string[] = [];
  lines.push(`# 海鸚泡芙｜發布錯誤詳情`);
  lines.push('');
  lines.push(`- **標題**：${post.title}`);
  lines.push(`- **狀態**：${post.status}`);
  lines.push(`- **建立時間**：${new Date(post.createdAt).toLocaleString('zh-TW')}`);
  if (post.finishedAt) {
    lines.push(`- **完成時間**：${new Date(post.finishedAt).toLocaleString('zh-TW')}`);
  }
  if (post.fileName) lines.push(`- **檔案**：\`${post.fileName}\``);
  if (post.filePath) lines.push(`- **路徑**：\`${post.filePath}\``);
  lines.push('');
  lines.push('## 各平台結果');
  for (const t of post.targets) {
    lines.push('');
    lines.push(`### ${t.platform.toUpperCase()}`);
    lines.push(`- 帳號：${t.accountName}`);
    lines.push(`- 狀態：**${t.status}**`);
    if (t.remoteUrl) lines.push(`- 連結：${t.remoteUrl}`);
    if (t.errorMessage) {
      lines.push(`- 錯誤訊息：`);
      lines.push('  ```');
      lines.push('  ' + t.errorMessage.split('\n').join('\n  '));
      lines.push('  ```');
    }
  }
  return lines.join('\n');
}

interface PostDetailProps {
  post: PostRecord;
  onClose: () => void;
  onRepublish: () => void;
  onReschedule: (newTime: Date) => void;
  onLoadDraft?: () => void;
}

function PostDetail({ post, onClose, onRepublish, onReschedule, onLoadDraft }: PostDetailProps) {
  const [previewOpened, setPreviewOpened] = useState(false);
  const [fetchingStats, setFetchingStats] = useState(false);
  const [livePost, setLivePost] = useState<PostRecord>(post);
  const [rescheduleAt, setRescheduleAt] = useState<Date | null>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1);
    d.setMinutes(0, 0, 0);
    return d;
  });

  // 同步外部 post 變動到內部 state（外部 refresh 時）
  useEffect(() => {
    setLivePost(post);
  }, [post]);

  const handleFetchStats = async () => {
    setFetchingStats(true);
    try {
      const updatedTargets = await window.puffin.posts.fetchStats(post.id) as PostTargetRecord[];
      setLivePost({ ...livePost, targets: updatedTargets });
      const total = updatedTargets.reduce((acc, t) => acc + (t.views ?? t.reach ?? 0), 0);
      notifications.show({
        title: '已抓取數據',
        message: total > 0 ? `總觸及 ${total.toLocaleString()}` : '抓取完成（部分平台可能無 insights 權限）',
        color: 'mint',
        icon: <IconCheck size={18} />
      });
    } catch (e) {
      notifications.show({
        title: '抓取失敗',
        message: (e as Error).message,
        color: 'red'
      });
    } finally {
      setFetchingStats(false);
    }
  };
  const canRepublish = post.status === 'failed' || post.status === 'partial';
  const canReschedule = post.status !== 'publishing' && post.status !== 'completed';
  const canLoadDraft = post.status === 'draft';
  const hasErrors = post.targets.some((t) => t.errorMessage);

  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(buildErrorMarkdown(post));
      notifications.show({
        title: '錯誤詳情已複製',
        message: 'Markdown 格式已放到剪貼簿，可貼到對話或 Issue',
        color: 'mint',
        icon: <IconCheck size={18} />
      });
    } catch (e) {
      notifications.show({
        title: '複製失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  return (
    <Modal opened onClose={onClose} title="發布細節" radius="xl" size="lg">
      <Stack gap="md">
        <Group gap="md" align="flex-start">
          <Avatar
            src={toMediaUrl(post.thumbnailPath)}
            radius="md"
            size={80}
            style={{ cursor: post.filePath ? 'pointer' : 'default' }}
            onClick={() => {
              if (post.filePath) setPreviewOpened(true);
            }}
          >
            {post.title[0] ?? '?'}
          </Avatar>
          <div>
            <Text size="lg" fw={700}>{post.title}</Text>
            <Text size="xs" c="dimmed">
              {formatDateTime(post.createdAt)}
              {post.finishedAt && ` · 完成於 ${formatDateTime(post.finishedAt)}`}
            </Text>
            {post.fileName && <Text size="xs" c="dimmed">{post.fileName}</Text>}
            <Badge mt={4} color={POST_STATUS_COLOR[post.status]} variant="light">
              {POST_STATUS_LABEL[post.status]}
            </Badge>
          </div>
        </Group>

        {post.description && (
          <div>
            <Text size="xs" c="dimmed" mb={2}>描述</Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {post.description}
            </Text>
          </div>
        )}

        {post.hashtags && (
          <div>
            <Text size="xs" c="dimmed" mb={2}>Hashtag</Text>
            <Text size="sm" c="sky.7">{post.hashtags}</Text>
          </div>
        )}

        <Divider />

        {hasErrors && (
          <Button
            variant="subtle"
            color="walnut"
            leftSection={<IconCopy size={14} />}
            onClick={handleCopyError}
            size="xs"
          >
            複製錯誤詳情（Markdown）
          </Button>
        )}

        {(canRepublish || canReschedule || canLoadDraft) && (
          <>
            <Divider label="可執行的動作" labelPosition="center" />
            <Stack gap="sm">
              {canLoadDraft && onLoadDraft && (
                <Button
                  color="mint"
                  leftSection={<IconEdit size={16} />}
                  onClick={onLoadDraft}
                  fullWidth
                >
                  繼續編輯此草稿（載回發布頁）
                </Button>
              )}
              {canRepublish && (
                <Button
                  color="mint"
                  leftSection={<IconRefresh size={16} />}
                  onClick={onRepublish}
                  fullWidth
                >
                  重新發布失敗的平台（不會重發已成功的）
                </Button>
              )}
              {canReschedule && (
                <Card padding="md">
                  <Stack gap="xs">
                    <Text size="sm" fw={600}>重新排程到未來時間</Text>
                    <DateTimePicker
                      value={rescheduleAt}
                      onChange={(v) =>
                        setRescheduleAt(v ? new Date(v as unknown as string | Date) : null)
                      }
                      minDate={new Date()}
                      placeholder="選日期 + 時間"
                      radius="md"
                      leftSection={<IconCalendarTime size={16} />}
                    />
                    <Button
                      color="lavender"
                      leftSection={<IconCalendarTime size={16} />}
                      onClick={() => rescheduleAt && onReschedule(rescheduleAt)}
                      disabled={!rescheduleAt}
                    >
                      加入排程
                    </Button>
                  </Stack>
                </Card>
              )}
            </Stack>
          </>
        )}

        <VideoPreviewModal
          opened={previewOpened}
          onClose={() => setPreviewOpened(false)}
          filePath={post.filePath}
          fileName={post.fileName}
          thumbnailPath={post.thumbnailPath}
        />

        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600}>各平台結果</Text>
            {post.status === 'completed' || post.status === 'partial' ? (
              <Button
                variant="light"
                color="sky"
                size="xs"
                leftSection={<IconRefresh size={12} />}
                onClick={handleFetchStats}
                loading={fetchingStats}
              >
                抓取數據
              </Button>
            ) : null}
          </Group>
          <Stack gap="sm">
            {livePost.targets.map((t) => {
              const meta = PLATFORM_ICON[t.platform];
              const Icon = meta.icon;
              const hasStats =
                t.views !== null && t.views !== undefined ||
                t.likesCount !== null && t.likesCount !== undefined ||
                t.commentsCount !== null && t.commentsCount !== undefined ||
                t.reach !== null && t.reach !== undefined;
              return (
                <Card key={t.platform} padding="md">
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Icon size={20} color={meta.color} />
                      <div>
                        <Text fw={600} size="sm">{meta.name}</Text>
                        <Text size="xs" c="dimmed">{t.accountName}</Text>
                      </div>
                    </Group>
                    <Badge color={TARGET_STATUS_COLOR[t.status]} variant="light">
                      {t.status}
                    </Badge>
                  </Group>
                  {t.remoteUrl && (
                    <Anchor
                      href={t.remoteUrl}
                      target="_blank"
                      size="xs"
                      mt="xs"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <IconExternalLink size={12} />
                      {t.remoteUrl}
                    </Anchor>
                  )}
                  {hasStats && (
                    <Group gap="md" mt="xs">
                      {(t.views ?? null) !== null && (
                        <div>
                          <Text size="xs" c="dimmed">觀看</Text>
                          <Text size="sm" fw={600}>{t.views!.toLocaleString()}</Text>
                        </div>
                      )}
                      {(t.reach ?? null) !== null && (
                        <div>
                          <Text size="xs" c="dimmed">觸及</Text>
                          <Text size="sm" fw={600}>{t.reach!.toLocaleString()}</Text>
                        </div>
                      )}
                      {(t.likesCount ?? null) !== null && (
                        <div>
                          <Text size="xs" c="dimmed">👍 讚</Text>
                          <Text size="sm" fw={600}>{t.likesCount!.toLocaleString()}</Text>
                        </div>
                      )}
                      {(t.commentsCount ?? null) !== null && (
                        <div>
                          <Text size="xs" c="dimmed">💬 留言</Text>
                          <Text size="sm" fw={600}>{t.commentsCount!.toLocaleString()}</Text>
                        </div>
                      )}
                      {(t.sharesCount ?? null) !== null && (
                        <div>
                          <Text size="xs" c="dimmed">🔄 分享</Text>
                          <Text size="sm" fw={600}>{t.sharesCount!.toLocaleString()}</Text>
                        </div>
                      )}
                      {t.statsFetchedAt && (
                        <Text size="xs" c="dimmed" style={{ alignSelf: 'flex-end' }}>
                          抓取於 {new Date(t.statsFetchedAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                    </Group>
                  )}
                  {t.statsError && (
                    <Text size="xs" c="orange" mt={4}>
                      ⚠ 數據抓取失敗：{t.statsError}
                    </Text>
                  )}
                  {t.errorMessage && (
                    <Text size="xs" c="red.7" mt={4}>
                      {t.errorMessage}
                    </Text>
                  )}
                </Card>
              );
            })}
          </Stack>
        </div>
      </Stack>
    </Modal>
  );
}

interface HistoryPageProps {
  onLoadDraft?: (postId: number) => void;
}

export function HistoryPage({ onLoadDraft }: HistoryPageProps = {}) {
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PostStatus | 'all'>('all');
  const [opened, setOpened] = useState<PostRecord | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await window.puffin.posts.list({ status: filter });
      setPosts(list);
    } catch (e) {
      console.error('load posts failed', e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 自動刷新（每 3 秒，捕捉發布過程中的狀態變化）
  useEffect(() => {
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleDelete = async (id: number) => {
    try {
      await window.puffin.posts.delete(id);
      notifications.show({
        title: '已刪除',
        message: '記錄已從歷史中移除',
        color: 'mint'
      });
      await refresh();
    } catch (e) {
      notifications.show({
        title: '刪除失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  const handleRepublish = async (post: PostRecord) => {
    try {
      await window.puffin.publish.republish(post.id, 'failedOnly');
      notifications.show({
        title: '已開始重新發布',
        message: `${post.title} 的失敗平台正在重試。可至發布頁查看進度`,
        color: 'mint',
        icon: <IconRefresh size={18} />
      });
      setOpened(null);
      await refresh();
    } catch (e) {
      notifications.show({
        title: '重新發布失敗',
        message: (e as Error).message,
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
    }
  };

  const handleReschedule = async (post: PostRecord, newTime: Date) => {
    try {
      await window.puffin.schedule.reschedule(post.id, newTime.getTime());
      notifications.show({
        title: '已重新排程',
        message: `${post.title} 將於 ${newTime.toLocaleString('zh-TW')} 自動發布`,
        color: 'lavender',
        icon: <IconCalendarTime size={18} />
      });
      setOpened(null);
      await refresh();
    } catch (e) {
      notifications.show({
        title: '重新排程失敗',
        message: (e as Error).message,
        color: 'red'
      });
    }
  };

  return (
    <Stack gap="lg" py="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2} c="walnut.8">歷史</Title>
          <Text c="dimmed" size="sm" mt={4}>
            每一次飛行的足跡與連結。
          </Text>
        </div>
        <Group gap="sm">
          {loading && <Loader size="sm" color="mint" />}
          {/* v0.9.9：清空歷史（保留尚未發布的排程）*/}
          {posts.length > 0 && (
            <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={async () => {
                if (!confirm(
                  `確定要清空所有歷史紀錄嗎？（共 ${posts.length} 筆）\n\n` +
                  `⚠ 此動作不可復原。\n` +
                  `「已排程、尚未發布」的項目會保留，其餘（成功 / 失敗 / 草稿）全部刪除。\n` +
                  `已發布到平台上的內容不受影響。`
                )) return;
                try {
                  const deleted = await window.puffin.system.clearHistory();
                  notifications.show({
                    title: '歷史已清空',
                    message: `刪除了 ${deleted} 筆紀錄（排程中的項目已保留）`,
                    color: 'mint'
                  });
                  await refresh();
                } catch (e) {
                  notifications.show({ title: '清空失敗', message: (e as Error).message, color: 'red' });
                }
              }}
            >
              清空歷史
            </Button>
          )}
        </Group>
      </Group>

      <SegmentedControl
        value={filter}
        onChange={(v) => setFilter(v as PostStatus | 'all')}
        color="mint"
        radius="lg"
        data={[
          { value: 'all', label: `全部 (${posts.length})` },
          { value: 'completed', label: '全部成功' },
          { value: 'partial', label: '部分成功' },
          { value: 'failed', label: '失敗' },
          { value: 'publishing', label: '發布中' },
          { value: 'draft', label: '草稿' }
        ]}
      />

      {posts.length === 0 && !loading ? (
        <Card>
          <Center py="xl">
            <Stack align="center" gap="md">
              <IconFileText size={64} color="#D8C6E8" stroke={1.5} />
              <Title order={4} c="walnut.7">沒有紀錄</Title>
              <Text c="dimmed" ta="center" maw={420}>
                {filter === 'all'
                  ? '還沒有發布過任何內容。回到「發布」頁開始你的第一支海鸚飛行。'
                  : `沒有符合「${POST_STATUS_LABEL[filter as PostStatus] ?? filter}」狀態的紀錄。`}
              </Text>
            </Stack>
          </Center>
        </Card>
      ) : (
        <Stack gap="sm">
          {posts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              onOpen={() => setOpened(post)}
              onDelete={() => handleDelete(post.id)}
              onRepublish={() => handleRepublish(post)}
            />
          ))}
        </Stack>
      )}

      {opened && (
        <PostDetail
          post={opened}
          onClose={() => setOpened(null)}
          onRepublish={() => handleRepublish(opened)}
          onReschedule={(t) => handleReschedule(opened, t)}
          onLoadDraft={
            onLoadDraft
              ? () => {
                  onLoadDraft(opened.id);
                  setOpened(null);
                }
              : undefined
          }
        />
      )}

      {posts.length > 0 && (
        <Group justify="flex-end">
          <Button
            variant="subtle"
            color="walnut"
            leftSection={<IconHistory size={16} />}
            onClick={refresh}
          >
            重新整理
          </Button>
        </Group>
      )}
    </Stack>
  );
}
