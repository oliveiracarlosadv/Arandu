import { lazy, Suspense } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { useRoute } from './hooks/useAppState';
import { ConsentHost } from './components/Consent';
import { HomePage } from './pages/HomePage';
import { Onboarding } from './components/Onboarding';

const ResultPage = lazy(() => import('./pages/ResultPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const ModelsPage = lazy(() => import('./pages/ModelsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

export function App() {
  const route = useRoute();
  let page;
  switch (route.page) {
    case 'result': page = <ResultPage id={route.param} />; break;
    case 'workspace': page = <WorkspacePage caseId={route.param} />; break;
    case 'models': page = <ModelsPage />; break;
    case 'settings': page = <SettingsPage />; break;
    case 'privacy': page = <PrivacyPage />; break;
    case 'about': page = <AboutPage />; break;
    default: page = <HomePage />;
  }
  return (
    <AppLayout route={route}>
      <Suspense fallback={<div className="py-20 text-center text-sm text-ink-500">Carregando…</div>}>{page}</Suspense>
      <ConsentHost />
      <Onboarding />
    </AppLayout>
  );
}
