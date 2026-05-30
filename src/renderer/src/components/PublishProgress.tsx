import {
  Card,
  Stack,
  Group,
  Title,
  Text,
  Badge,
  Progress,
  Button,
  Anchor,
  ThemeIcon
} from '@mantine/core';
import {
  IconBrandYoutube,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandThreads,
  IconCheck,
  IconAlertTriangle,
  IconLoader,
  IconExternalLink,
  IconRefresh,
  IconTransform,
  type Icon
} from '@tabler/icons-react';
import type {
  PublishJobState,
  PublishPlatformState
} from '../../../shared/types';

const PLATFORM_META: Record<
  PublishPlatformState['platform'],
  { name: string; icon: Icon; color: string }
> = {
  youtube: { name: 'YouTube', icon: IconBrandYoutube, color: '#FF0000' },
  facebook: { name: 'Facebook', icon: IconBrandFacebook, color: '#1877F2' },
  instagram: { name: 'Instagram', icon: IconBrandInstagram, color: '#E4405F' },
  threads: { name: 'Threads', icon: IconBrandThreads, color: '#000000' }
};

const STATUS_LABEL: Record<PublishPlatformState['status'], string> = {
  pending: '排隊中',
  uploading: '上傳中',
  success: '已發布',
  failed: '失敗',
  cancelled: '已取消'
};

const STATUS_COLOR: Record<PublishPlatformState['status'], string> = {
  pending: 'walnut',
  uploading: 'mint',
  success: 'mint',
  failed: 'red',
  cancelled: 'walnut'
};

function formatBytes(b: number | undefined): string {
  if (b === undefined) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface PlatformRowProps {
  state: PublishPlatformState;
}

function PlatformRow({ state }: PlatformRowProps) {
  const meta = PLATFORM_META[state.platform];
  const PlatformIcon = meta.icon;

  return (
    <Card padding="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <PlatformIcon size={22} color={meta.color} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text fw={600} size="sm" lineClamp={1}>
              {meta.name}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {state.accountName}
            </Text>
          </div>
        </Group>
        <Badge
          color={STATUS_COLOR[state.status]}
          variant="light"
          leftSection={
            state.status === 'success' ? (
              <IconCheck size={12} />
            ) : state.status === 'failed' ? (
              <IconAlertTriangle size={12} />
            ) : state.status === 'uploading' ? (
              <IconLoader size={12} className="spin" />
            ) : null
          }
        >
          {STATUS_LABEL[state.status]}
        </Badge>
      </Group>

      {(state.status === 'uploading' || state.status === 'pending') && (
        <>
          <Progress
            value={state.percent}
            color={STATUS_COLOR[state.status]}
            radius="xl"
            size="md"
            animated={state.status === 'uploading'}
          />
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed">
              {state.percent.toFixed(0)}%
            </Text>
            {state.bytesUploaded !== undefined && state.totalBytes !== undefined && (
              <Text size="xs" c="dimmed">
                {formatBytes(state.bytesUploaded)} / {formatBytes(state.totalBytes)}
              </Text>
            )}
          </Group>
        </>
      )}

      {state.status === 'success' && state.url && (
        <Anchor
          href={state.url}
          target="_blank"
          size="sm"
          c="mint.7"
          fw={600}
          underline="hover"
        >
          <Group gap={4}>
            <IconExternalLink size={14} />
            打開發布的影片
          </Group>
        </Anchor>
      )}

      {state.status === 'failed' && state.error && (
        <>
          <Text size="xs" c="red.7" mt={4} style={{ whiteSpace: 'pre-wrap' }}>
            {state.error}
          </Text>
          {/* v0.6.9：複製錯誤詳情按鈕（debug 用） */}
          <Group gap="xs" mt={4}>
            <Anchor
              size="xs"
              c="walnut"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                navigator.clipboard.writeText(
                  `=== PuffinPuff ${state.platform.toUpperCase()} 失敗 ===\n` +
                  `時間：${new Date().toLocaleString('zh-TW')}\n` +
                  `平台：${state.platform}\n` +
                  `帳號：${state.accountName}\n` +
                  `錯誤：${state.error}`
                );
              }}
            >
              📋 複製錯誤
            </Anchor>
          </Group>
        </>
      )}
    </Card>
  );
}

interface PublishProgressProps {
  job: PublishJobState;
  onCancel: () => void;
  onReset: () => void;
}

export function PublishProgress({ job, onCancel, onReset }: PublishProgressProps) {
  const isRunning = job.overallStatus === 'running';
  const successCount = job.platforms.filter((p) => p.status === 'success').length;
  const failCount = job.platforms.filter((p) => p.status === 'failed').length;
  const totalCount = job.platforms.length;

  return (
    <Card>
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <ThemeIcon
            size="lg"
            radius="xl"
            color={
              job.overallStatus === 'done'
                ? failCount === 0
                  ? 'mint'
                  : 'mango'
                : job.overallStatus === 'failed'
                  ? 'red'
                  : 'mint'
            }
            variant="light"
          >
            {job.overallStatus === 'running' ? (
              <IconLoader size={20} className="spin" />
            ) : job.overallStatus === 'failed' ? (
              <IconAlertTriangle size={20} />
            ) : (
              <IconCheck size={20} />
            )}
          </ThemeIcon>
          <div>
            <Title order={4} c="walnut.8">
              {isRunning
                ? '海鸚正在飛行 ✈️'
                : job.overallStatus === 'cancelled'
                  ? '已取消'
                  : failCount === 0
                    ? '全部發布成功 🎉'
                    : `部分成功（${successCount} / ${totalCount}）`}
            </Title>
            <Text size="xs" c="dimmed">
              {isRunning ? `${successCount}/${totalCount} 完成` : '工作結束'}
            </Text>
          </div>
        </Group>

        {isRunning ? (
          <Button color="red" variant="light" onClick={onCancel}>
            取消全部
          </Button>
        ) : (
          <Button
            color="mint"
            leftSection={<IconRefresh size={16} />}
            onClick={onReset}
          >
            發布下一支
          </Button>
        )}
      </Group>

      {job.transcoding && (
        <Card padding="md" mb="sm" style={{ backgroundColor: '#FFF5D8' }}>
          <Group gap="sm" mb="xs">
            <IconTransform size={20} color="#E5B23D" className="spin" />
            <div>
              <Text fw={600} size="sm">影片預處理中（自動轉檔）</Text>
              <Text size="xs" c="dimmed">
                規格不相容，轉成 H.264 1080×1920 30fps 以確保三平台都能上傳
              </Text>
            </div>
          </Group>
          <Progress
            value={job.transcoding.percent}
            color="mango"
            radius="xl"
            size="md"
            animated
          />
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed">
              {job.transcoding.percent.toFixed(0)}%
            </Text>
            <Text size="xs" c="dimmed">
              {job.transcoding.currentSec.toFixed(1)}s / {job.transcoding.durationSec.toFixed(1)}s
            </Text>
          </Group>
        </Card>
      )}

      <Stack gap="sm">
        {job.platforms.map((p) => (
          <PlatformRow key={p.platform} state={p} />
        ))}
      </Stack>
    </Card>
  );
}
