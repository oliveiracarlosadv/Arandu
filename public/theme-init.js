// Aplica o tema salvo antes da renderização (evita flash de tema incorreto).
try {
  var t = JSON.parse(localStorage.getItem('arandu.settings') || '{}').theme || 'system';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
