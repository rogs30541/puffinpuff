import { useEffect, useState } from 'react';
import {
  Card,
  Tabs,
  TextInput,
  Textarea,
  Radio,
  Group,
  Stack,
  Title,
  Text,
  Switch,
  Box,
  UnstyledButton,
  Tooltip,
  Select,
  Avatar
} from '@mantine/core';
import {
  IconLayoutGrid,
  IconBrandYoutube,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandThreads,
  IconUser
} from '@tabler/icons-react';
import {
  DEFAULT_PUBLISH_CONTENT,
  PLATFORM_LIMITS,
  type AccountPublic,
  type PublishContent,
  type Privacy
} from '../../../shared/types';

type PlatformKey = 'youtube' | 'facebook' | 'instagram' | 'threads';

interface ContentEditorProps {
  value?: PublishContent;
  onChange: (content: PublishContent) => void;
}

const PLATFORM_META: Record<
  PlatformKey,
  {
    name: string;
    color: string;
    supportsTitle: boolean;
    supportsPrivacy: boolean;
  }
> = {
  youtube: { name: 'YouTube', color: '#FF0000', supportsTitle: true, supportsPrivacy: true },
  facebook: { name: 'Facebook', color: '#1877F2', supportsTitle: false, supportsPrivacy: false },
  instagram: { name: 'Instagram', color: '#E4405F', supportsTitle: false, supportsPrivacy: false },
  // v0.7.0：Threads — 純文字社群、無標題、無隱私（一律公開）
  threads: { name: 'Threads', color: '#000000', supportsTitle: false, supportsPrivacy: false }
};

interface PlatformChipProps {
  platform: PlatformKey;
  enabled: boolean;
  onToggle: () => void;
}

function PlatformChip({ platform, enabled, onToggle }: PlatformChipProps) {
  const meta = PLATFORM_META[platform];
  return (
    <Tooltip
      label={enabled ? `已啟用 ${meta.name}（點此停用）` : `${meta.name} 不會發布（點此啟用）`}
      withArrow
    >
      <UnstyledButton
        onClick={onToggle}
        style={{
          padding: '6px 14px',
          borderRadius: 999,
          backgroundColor: enabled ? meta.color : '#F3F1EF',
          color: enabled ? '#FFFFFF' : '#948A7E',
          fontSize: 13,
          fontWeight: 600,
          border: enabled ? `1px solid ${meta.color}` : '1px solid #E5DCD3',
          transition: 'all 150ms ease',
          textDecoration: enabled ? 'none' : 'line-through',
          opacity: enabled ? 1 : 0.7
        }}
      >
        {enabled ? '✓' : '✕'} {meta.name}
      </UnstyledButton>
    </Tooltip>
  );
}

function CharCounter({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length;
  const color = remaining < 0 ? 'red' : remaining < max * 0.1 ? 'mango' : 'dimmed';
  return (
    <Text size="xs" c={color} ta="right">
      {value.length} / {max}
    </Text>
  );
}

export function ContentEditor({ value, onChange }: ContentEditorProps) {
  const [content, setContent] = useState<PublishContent>(value ?? DEFAULT_PUBLISH_CONTENT);
  const [activeTab, setActiveTab] = useState<string | null>('common');
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);

  useEffect(() => {
    onChange(content);
    // 故意不把 onChange 放進 deps，避免父層 closure 重建造成迴圈
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  useEffect(() => {
    window.puffin.accounts.list().then(setAccounts).catch(() => {});
  }, []);

  const accountsByPlatform = (platform: PlatformKey): AccountPublic[] =>
    accounts.filter((a) => a.platform === platform);

  const updateCommon = <K extends keyof PublishContent['common']>(
    field: K,
    val: PublishContent['common'][K]
  ) => {
    setContent((c) => ({ ...c, common: { ...c.common, [field]: val } }));
  };

  const updatePlatform = (platform: PlatformKey, patch: Partial<PublishContent['perPlatform'][PlatformKey]>) => {
    setContent((c) => ({
      ...c,
      perPlatform: { ...c.perPlatform, [platform]: { ...c.perPlatform[platform], ...patch } }
    }));
  };

  const renderPlatformPanel = (platform: PlatformKey) => {
    const meta = PLATFORM_META[platform];
    const limits = PLATFORM_LIMITS[platform];
    const override = content.perPlatform[platform];
    const common = content.common;
    const platformAccounts = accountsByPlatform(platform);
    const selectedAccountId = override.accountId ?? platformAccounts[0]?.id;
    const selectedAccount = platformAccounts.find((a) => a.id === selectedAccountId);

    return (
      <Stack gap="md" pt="md">
        <Switch
          checked={override.enabled}
          onChange={(e) => updatePlatform(platform, { enabled: e.currentTarget.checked })}
          label={`啟用發布到 ${meta.name}`}
          description={override.enabled ? '此平台會被排入發布' : '此平台不會發布'}
          color="mint"
          size="md"
        />

        {override.enabled && platformAccounts.length === 0 && (
          <Box style={{ backgroundColor: '#FCE4A6', borderRadius: 14, padding: 12 }}>
            <Text size="sm" c="walnut.8">
              ⚠ 沒有連線的 {meta.name} 帳號 — 請至「帳號」頁連線後再啟用
            </Text>
          </Box>
        )}

        {override.enabled && platformAccounts.length >= 2 && (
          <Select
            label={`發布到哪個 ${meta.name} 帳號`}
            description={`此平台目前連線 ${platformAccounts.length} 個帳號`}
            data={platformAccounts.map((a) => ({
              value: String(a.id),
              label: a.displayName
            }))}
            value={selectedAccountId !== undefined ? String(selectedAccountId) : null}
            onChange={(v) =>
              updatePlatform(platform, {
                accountId: v !== null ? parseInt(v, 10) : undefined
              })
            }
            leftSection={<IconUser size={16} />}
            radius="md"
            allowDeselect={false}
          />
        )}

        {override.enabled && platformAccounts.length === 1 && selectedAccount && (
          <Group gap="xs">
            <Avatar
              src={(selectedAccount.metadata?.thumbnail as string | null) ?? null}
              size="sm"
              radius="xl"
            >
              {selectedAccount.displayName[0]}
            </Avatar>
            <Text size="xs" c="dimmed">
              將發布到：<Text component="span" fw={600}>{selectedAccount.displayName}</Text>
            </Text>
          </Group>
        )}

        {override.enabled && (
          <Stack gap="md">
            <Text size="xs" c="dimmed">
              未填的欄位會自動使用「共通」分頁的值。
            </Text>

            {meta.supportsTitle && (
              <Box>
                <TextInput
                  label="標題（覆寫）"
                  placeholder={common.title || '使用共通標題'}
                  value={override.title ?? ''}
                  onChange={(e) =>
                    updatePlatform(platform, { title: e.currentTarget.value || undefined })
                  }
                  maxLength={limits.title}
                />
                {override.title !== undefined && override.title !== '' && (
                  <CharCounter value={override.title} max={limits.title} />
                )}
              </Box>
            )}

            <Box>
              <Textarea
                label={meta.supportsTitle ? '描述（覆寫）' : '貼文內容（覆寫）'}
                placeholder={common.description || '使用共通描述'}
                value={override.description ?? ''}
                onChange={(e) =>
                  updatePlatform(platform, { description: e.currentTarget.value || undefined })
                }
                autosize
                minRows={3}
                maxRows={8}
                maxLength={limits.description}
              />
              {override.description !== undefined && override.description !== '' && (
                <CharCounter value={override.description} max={limits.description} />
              )}
            </Box>

            <TextInput
              label="Hashtag（覆寫）"
              placeholder={common.hashtags || '使用共通 #tag'}
              value={override.hashtags ?? ''}
              onChange={(e) =>
                updatePlatform(platform, { hashtags: e.currentTarget.value || undefined })
              }
            />

            {meta.supportsPrivacy && (
              <Radio.Group
                label="隱私（覆寫）"
                value={override.privacy ?? ''}
                onChange={(v) =>
                  updatePlatform(platform, {
                    privacy: v === '' ? undefined : (v as Privacy)
                  })
                }
              >
                <Group>
                  <Radio value="" label="使用共通設定" />
                  <Radio value="public" label="公開" />
                  <Radio value="private" label="不公開" />
                </Group>
              </Radio.Group>
            )}
          </Stack>
        )}
      </Stack>
    );
  };

  return (
    <Card>
      <Group justify="space-between" mb="sm" align="center" wrap="wrap">
        <div>
          <Title order={4} c="walnut.8">內容</Title>
          <Text size="xs" c="dimmed" mt={2}>
            點下方平台名稱可快速啟用/停用發布
          </Text>
        </div>
        <Group gap={8}>
          {(Object.keys(content.perPlatform) as PlatformKey[]).map((p) => (
            <PlatformChip
              key={p}
              platform={p}
              enabled={content.perPlatform[p].enabled}
              onToggle={() => updatePlatform(p, { enabled: !content.perPlatform[p].enabled })}
            />
          ))}
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab} variant="pills" color="mint" radius="lg">
        <Tabs.List>
          <Tabs.Tab value="common" leftSection={<IconLayoutGrid size={16} />}>
            共通
          </Tabs.Tab>
          <Tabs.Tab value="youtube" leftSection={<IconBrandYoutube size={16} color="#FF0000" />}>
            YouTube
          </Tabs.Tab>
          <Tabs.Tab value="facebook" leftSection={<IconBrandFacebook size={16} color="#1877F2" />}>
            Facebook
          </Tabs.Tab>
          <Tabs.Tab value="instagram" leftSection={<IconBrandInstagram size={16} color="#E4405F" />}>
            Instagram
          </Tabs.Tab>
          <Tabs.Tab value="threads" leftSection={<IconBrandThreads size={16} color="#000000" />}>
            Threads
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="common">
          <Stack gap="md" pt="md">
            <TextInput
              label="標題"
              description={
                content.common.title.includes('{檔名}')
                  ? '提示：拖入影片後，{檔名} 會自動替換為實際檔名（去副檔名）'
                  : undefined
              }
              placeholder="例：工作寫四萬，為什麼入職後差很大？"
              value={content.common.title}
              onChange={(e) => updateCommon('title', e.currentTarget.value)}
              maxLength={PLATFORM_LIMITS.youtube.title}
            />
            <CharCounter value={content.common.title} max={PLATFORM_LIMITS.youtube.title} />

            <Textarea
              label="描述"
              placeholder="影片內容描述..."
              value={content.common.description}
              onChange={(e) => updateCommon('description', e.currentTarget.value)}
              autosize
              minRows={3}
              maxRows={8}
            />
            <Text size="xs" c="dimmed" ta="right">
              {content.common.description.length} 字（各平台上限不同）
            </Text>

            <TextInput
              label="Hashtag"
              placeholder="#shorts #職場 #薪資"
              value={content.common.hashtags}
              onChange={(e) => updateCommon('hashtags', e.currentTarget.value)}
              description="用空格分隔。例：#shorts #life #fyp"
            />

            <Radio.Group
              label="預設隱私"
              value={content.common.privacy}
              onChange={(v) => updateCommon('privacy', v as Privacy)}
              description="僅 YouTube 支援；FB/IG 一律公開"
            >
              <Group mt={4}>
                <Radio value="public" label="公開" color="mint" />
                <Radio value="private" label="不公開" color="mint" />
              </Group>
            </Radio.Group>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="youtube">{renderPlatformPanel('youtube')}</Tabs.Panel>
        <Tabs.Panel value="facebook">{renderPlatformPanel('facebook')}</Tabs.Panel>
        <Tabs.Panel value="instagram">{renderPlatformPanel('instagram')}</Tabs.Panel>
        <Tabs.Panel value="threads">{renderPlatformPanel('threads')}</Tabs.Panel>
      </Tabs>
    </Card>
  );
}
