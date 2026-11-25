import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App';
import { applyTheme, getSettings } from './services/settings';
import { initPwa } from './services/pwa';
import { configureQueue } from './modules/batch/queue';
import { ensureOcrWithConsent } from './components/Consent';
import { purgeExpired } from './services/history';

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

configureQueue({
  ensureOcr: ensureOcrWithConsent,
  options: () => {
    const s = getSettings();
    return {
      mode: s.mode,
      ocrQuality: s.ocrQuality,
      legalAnalysis: s.legalAnalysis,
      includePageMarkers: s.includePageMarkers,
      useAi: s.useAi,
      maxFileSizeMb: s.maxFileSizeMb,
    };
  },
});

void initPwa();
void purgeExpired().catch(() => undefined);

// Impede que arquivos soltos fora da área de upload sejam abertos pelo navegador.
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
