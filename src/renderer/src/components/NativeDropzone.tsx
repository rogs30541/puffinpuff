import { useState, type ReactNode, type DragEvent } from 'react';
import { Stack, Text, Button, Loader, Box } from '@mantine/core';
import { IconCloudUpload, IconAlertTriangle } from '@tabler/icons-react';

interface NativeDropzoneProps {
  onFilePath: (path: string) => void;
  onDropError: (message: string) => void;
  loading?: boolean;
  /** 從電腦選檔按鈕的點擊處理 */
  onPickClick: () => void;
  /** 子內容（取代預設文案）*/
  children?: ReactNode;
}

/**
 * 自製拖拉區，**不**經過 react-dropzone / Mantine Dropzone 的包裝，
 * 直接讀取原生 `event.dataTransfer.files`，保留 Electron 附加的檔案路徑。
 *
 * 為什麼不用 Mantine Dropzone：那個元件會在 onDrop 時建立新的 File 物件
 * 與 attach-accept 邏輯處理，過程中會弄丟 Electron 的 path 附加屬性，
 * 使 `webUtils.getPathForFile(file)` 回傳空字串。
 */
export function NativeDropzone({
  onFilePath,
  onDropError,
  loading = false,
  onPickClick,
  children
}: NativeDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      onDropError('沒有偵測到檔案');
      return;
    }

    const file = files[0];
    const path = window.puffin.media.getPathForFile(file);
    if (!path) {
      onDropError(
        `無法從拖拉檔案取得路徑（檔名：${file.name}）。請改用「從電腦選檔」按鈕。`
      );
      return;
    }
    onFilePath(path);
  };

  return (
    <Box
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        backgroundColor: isDragOver ? '#E2F5EC' : '#FFFFFF',
        borderColor: isDragOver ? '#6FBF9D' : '#B8E0D2',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderRadius: 18,
        padding: 48,
        transition: 'background-color 150ms ease, border-color 150ms ease',
        position: 'relative',
        minHeight: 280
      }}
    >
      <Stack align="center" gap="md">
        {loading ? (
          <Loader size="lg" color="mint" />
        ) : (
          <IconCloudUpload
            size={72}
            color={isDragOver ? '#6FBF9D' : '#B8E0D2'}
            stroke={1.5}
          />
        )}

        {children ?? (
          <div style={{ textAlign: 'center' }}>
            <Text size="xl" fw={700} c="walnut.8">
              {isDragOver ? '放手吧 🐧' : '拖拉影片到這裡'}
            </Text>
            <Text size="sm" c="dimmed" mt={4}>
              支援 MP4 / MOV / WebM / MKV / 圖片，最大 5 GB
            </Text>
          </div>
        )}

        <Button
          size="md"
          color="mint"
          onClick={onPickClick}
          loading={loading}
          leftSection={<IconCloudUpload size={18} />}
          mt="md"
        >
          從電腦選檔
        </Button>
      </Stack>
    </Box>
  );
}

// Re-export icon to keep import surface stable for callers
export { IconAlertTriangle };
