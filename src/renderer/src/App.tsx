import { useEffect, useState } from 'react';
import { AppShell, Box } from '@mantine/core';
import { Sidebar, type PageKey } from './components/Sidebar';
import { PublishPage } from './pages/PublishPage';
import { SchedulePage } from './pages/SchedulePage';
import { HistoryPage } from './pages/HistoryPage';
import { AccountsPage } from './pages/AccountsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { SettingsPage } from './pages/SettingsPage';


export function App() {
  const [activePage, setActivePage] = useState<PageKey>('publish');
  const [draftIdToLoad, setDraftIdToLoad] = useState<number | null>(null);

  // 訂閱「導覽快捷鍵」事件（Ctrl+1-5）
  useEffect(() => {
    const unsubscribe = window.puffin.shortcuts.onNavigate((target) => {
      setActivePage(target as PageKey);
    });
    return unsubscribe;
  }, []);

  const handleLoadDraft = (postId: number) => {
    setDraftIdToLoad(postId);
    setActivePage('publish');
  };

  const renderActive = () => {
    switch (activePage) {
      case 'publish':
        return (
          <PublishPage
            draftIdToLoad={draftIdToLoad}
            onDraftLoaded={() => setDraftIdToLoad(null)}
          />
        );
      case 'schedule':
        return <SchedulePage />;
      case 'history':
        return <HistoryPage onLoadDraft={handleLoadDraft} />;
      case 'accounts':
        return <AccountsPage />;
      case 'templates':
        return <TemplatesPage />;
      case 'settings':
        return <SettingsPage />;
    }
  };

  return (
    <AppShell
      navbar={{ width: 220, breakpoint: 0 }}
      padding={0}
      styles={{
        main: {
          backgroundColor: '#FBF7F2',
          height: '100vh',
          overflowY: 'auto'
        },
        navbar: {
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E5DCD3'
        }
      }}
    >
      <AppShell.Navbar>
        <Sidebar active={activePage} onChange={setActivePage} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Box style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px 80px' }}>
          {renderActive()}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
