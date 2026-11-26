(() => {
  const script = document.currentScript;
  const endpoint = new URL(script?.dataset.endpoint || '/api/events', script?.src || window.location.href).href;
  const key = 'signal_analytics_session_id';
  let sessionId;
  try {
    sessionId = localStorage.getItem(key);
    if (!sessionId) {
      sessionId = window.crypto?.randomUUID?.() || `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(key, sessionId);
    }
  } catch {
    sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }

  const send = (eventType, extra = {}) => {
    const event = {
      session_id: sessionId,
      event_type: eventType,
      page_url: window.location.href,
      timestamp: new Date().toISOString(),
      ...extra,
    };
    try {
      const body = JSON.stringify(event);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
      }
    } catch { /* Analytics must never interrupt the host page. */ }
  };

  send('page_view');
  document.addEventListener('click', (event) => {
    send('click', {
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
    });
  }, { passive: true });
  window.SignalAnalytics = { sessionId };
})();
