import { createTheme, MantineColorsTuple } from '@mantine/core';

// 馬卡龍配色｜薄荷綠（主色）
const mint: MantineColorsTuple = [
  '#F1FAF6',
  '#E2F5EC',
  '#CFEDE0',
  '#B8E0D2', // base
  '#9DD0BC',
  '#82C5AC',
  '#6FBF9D', // primary action
  '#5BA686',
  '#468870',
  '#2F6E58'
];

// 馬卡龍配色｜櫻花粉（CTA）
const sakura: MantineColorsTuple = [
  '#FEF4F8',
  '#FCEAF1',
  '#FBDDE9',
  '#F8C8DC', // base
  '#F4ABC8',
  '#EE8FB4',
  '#E374A0', // primary
  '#C45B86',
  '#A1456C',
  '#7C3050'
];

// 馬卡龍配色｜薰衣紫（次要強調）
const lavender: MantineColorsTuple = [
  '#F8F4FB',
  '#F0E8F5',
  '#E6DAEE',
  '#D8C6E8', // base
  '#C5ADDC',
  '#B393CF',
  '#A07AC2',
  '#8261A2',
  '#654A80',
  '#4A355F'
];

// 馬卡龍配色｜芒果黃（提醒/警示）
const mango: MantineColorsTuple = [
  '#FFFAEC',
  '#FFF5D8',
  '#FFEEC0',
  '#FCE4A6', // base
  '#F8D682',
  '#F2C75D',
  '#E5B23D',
  '#C7942A',
  '#A1761E',
  '#785814'
];

// 馬卡龍配色｜天藍（資訊）
const sky: MantineColorsTuple = [
  '#F3FAFC',
  '#E5F4F7',
  '#D2EAEF',
  '#BEDFE5', // base
  '#A2CFD7',
  '#87BEC9',
  '#6CAFBA',
  '#54919C',
  '#41747E',
  '#2F555E'
];

// 海鸚橘（強調色，喙色、品牌記憶點）
const puffin: MantineColorsTuple = [
  '#FFF3EC',
  '#FFE5D2',
  '#FFD2B0',
  '#FFBC8B',
  '#FFA468',
  '#FF8C42', // base
  '#F07026',
  '#CC591A',
  '#A24412',
  '#793008'
];

// 深胡桃（取代純黑的文字色）
const walnut: MantineColorsTuple = [
  '#F3F1EF',
  '#E8E4E0',
  '#D2CCC4',
  '#B3ABA0',
  '#948A7E',
  '#756B62',
  '#5C534B',
  '#4E4641',
  '#3F3A36', // base text
  '#2A2624'
];

export const theme = createTheme({
  primaryColor: 'mint',
  primaryShade: { light: 6, dark: 4 },
  colors: {
    mint,
    sakura,
    lavender,
    mango,
    sky,
    puffin,
    walnut
  },
  fontFamily:
    "'Noto Sans TC', 'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  headings: {
    fontFamily:
      "'Noto Sans TC', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: '700'
  },
  defaultRadius: 'lg',
  radius: {
    xs: '6px',
    sm: '10px',
    md: '14px',
    lg: '18px',
    xl: '24px'
  },
  cursorType: 'pointer',
  black: '#3F3A36',
  white: '#FFFFFF',
  shadows: {
    xs: '0 1px 2px rgba(63, 58, 54, 0.04)',
    sm: '0 2px 6px rgba(63, 58, 54, 0.06)',
    md: '0 4px 14px rgba(63, 58, 54, 0.08)',
    lg: '0 8px 24px rgba(63, 58, 54, 0.10)',
    xl: '0 16px 40px rgba(63, 58, 54, 0.12)'
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'xl'
      }
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
        padding: 'lg',
        withBorder: true
      }
    },
    TextInput: {
      defaultProps: {
        radius: 'md'
      }
    },
    Textarea: {
      defaultProps: {
        radius: 'md'
      }
    },
    Select: {
      defaultProps: {
        radius: 'md'
      }
    },
    Modal: {
      defaultProps: {
        radius: 'xl'
      }
    }
  }
});

// 全域背景與文字色（在 globals.css 中參考用）
export const palette = {
  bgApp: '#FBF7F2', // 奶油白（主背景）
  bgCard: '#FFFFFF', // 象牙白（卡片）
  border: '#E5DCD3', // 暖灰（邊框）
  textPrimary: '#3F3A36',
  textSecondary: '#7C736B',
  success: '#6FBF9D',
  danger: '#E08B97'
};
