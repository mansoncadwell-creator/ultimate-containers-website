(() => {
  'use strict';

  const KEY = 'uci_cookie_preferences_v1';
  const VISITOR_KEY = 'uci_analytics_visitor';
  const SESSION_KEY = 'uci_analytics_session';

  function getId(key) {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  function trackPage() {
    try {
      const preferences = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!preferences || preferences.analytics !== true) return;

      const visitorId = getId(VISITOR_KEY);
      let sessionId = sessionStorage.getItem(SESSION_KEY);

      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, sessionId);
      }

      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor_id: visitorId,
          session_id: sessionId,
          session_id: sessionId,
          page_path: location.pathname,
          device_type: /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          referrer: document.referrer
        }),
        keepalive: true
      }).catch(() => {});
    } catch (_) {}
  }

  trackPage();
  document.addEventListener('click', event => { if (event.target.closest('#cookie-accept, #cookie-save')) trackPage(); });
  window.addEventListener('storage', event => {
    if (event.key === KEY && event.newValue) trackPage();
  });
})();



