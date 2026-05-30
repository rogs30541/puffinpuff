import { Modal, Stack, Text, Box, ActionIcon, Group } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

interface VideoPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  filePath: string | null;
  fileName?: string | null;
  thumbnailPath?: string | null;
}

function toMediaUrl(filePath: string): string {
  return `puffin-media:///${encodeURI(filePath.replace(/\\/g, '/'))}`;
}

export function VideoPreviewModal({
  opened,
  onClose,
  filePath,
  fileName,
  thumbnailPath
}: VideoPreviewModalProps) {
  if (!filePath) return null;
  const isVideo = /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(filePath);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Text fw={700} size="md">{fileName ?? '影片預覽'}</Text>
          <ActionIcon
            variant="subtle"
            color="walnut"
            size="sm"
            onClick={() => {
              // 用系統預設播放器開（不是 Electron 內建）
              window.puffin.system.openDataFolder().catch(() => {});
            }}
          >
            <IconExternalLink size={14} />
          </ActionIcon>
        </Group>
      }
      radius="xl"
      size="auto"
      centered
      styles={{
        body: { padding: 0 },
        content: { backgroundColor: '#000' }
      }}
    >
      <Stack gap={0}>
        <Box
          style={{
            backgroundColor: '#000',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400
          }}
        >
          {isVideo ? (
            <video
              src={toMediaUrl(filePath)}
              poster={thumbnailPath ? toMediaUrl(thumbnailPath) : undefined}
              controls
              autoPlay
              style={{
                maxWidth: '80vw',
                maxHeight: '80vh',
                display: 'block'
              }}
            />
          ) : (
            <img
              src={toMediaUrl(filePath)}
              alt={fileName ?? ''}
              style={{
                maxWidth: '80vw',
                maxHeight: '80vh',
                display: 'block'
              }}
            />
          )}
        </Box>
      </Stack>
    </Modal>
  );
}
