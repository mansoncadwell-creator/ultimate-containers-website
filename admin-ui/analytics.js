(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const charts = {};

  function draw(id, type, labels, datasets, options = {}) {
    const canvas = $(id);
    if (!canvas || typeof Chart === 'undefined') return;

    if (charts[id]) charts[id].destroy();

    charts[id] = new Chart(canvas, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: type !== 'bar' } },
        scales: type === 'doughnut' ? {} : {
          y: { beginAtZero: true }
        },
        ...options
      }
    });
  }

  function fill(id, items, first, second) {
    if (!$(id)) return;
    $(id).innerHTML = items.length
      ? items.map(x => `<tr><td>${esc(x[first])}</td><td>${esc(x[second])}</td></tr>`).join('')
      : '<tr><td colspan="2">No data yet.</td></tr>';
  }

  async function loadAnalytics() {
    try {
      const days = $('analytics-period')?.value || '7';
      const response = await fetch('/api/admin/analytics?days=' + encodeURIComponent(days), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load analytics.');

      const stats = data.stats || {};
      [
        ['a-views', 'totalViews'],
        ['a-visitors', 'uniqueVisitors'],
        ['a-sessions', 'totalSessions'],
        ['a-today-visitors', 'visitorsToday'],
        ['a-today-views', 'viewsToday']
      ].forEach(([id, key]) => {
        if ($(id)) $(id).textContent = Number(stats[key] || 0).toLocaleString();
      });

      fill('a-pages', data.pages || [], 'page_path', 'views');
      fill('a-devices', data.devices || [], 'device_type', 'total');
      fill('a-referrals', data.referrals || [], 'source', 'total');

      if ($('a-recent')) {
        $('a-recent').innerHTML = (data.recent || []).length
          ? data.recent.map(x =>
              `<tr><td>${esc(x.page_path)}</td><td>${esc(x.device_type)}</td><td>${esc(x.event_type)}</td><td>${esc(x.created_at)}</td></tr>`
            ).join('')
          : '<tr><td colspan="4">No activity yet.</td></tr>';
      }

      const c = data.charts || {};
      const trend = c.trend || [];

      draw('traffic-chart', 'line',
        trend.map(x => x.day),
        [
          { label: 'Page views', data: trend.map(x => x.views), borderColor: '#2878c8', tension: 0.3 },
          { label: 'Unique visitors', data: trend.map(x => x.visitors), borderColor: '#16a36a', tension: 0.3 }
        ]
      );

      const devices = c.devices || [];
      draw('device-chart', 'doughnut',
        devices.map(x => x.device_type),
        [{ data: devices.map(x => x.total), backgroundColor: ['#2878c8','#16a36a','#e6a23c','#8b70c9'] }]
      );

      const pages = c.pages || [];
      draw('pages-chart', 'bar',
        pages.map(x => x.page_path),
        [{ label: 'Page views', data: pages.map(x => x.views), backgroundColor: '#2878c8' }]
      );

      const sources = c.referrals || [];
      draw('sources-chart', 'doughnut',
        sources.map(x => x.source),
        [{ data: sources.map(x => x.total), backgroundColor: ['#2878c8','#16a36a','#e6a23c','#8b70c9','#d36b86','#5b9da5'] }]
      );

    } catch (error) {
      if ($('dashboard-message')) {
        $('dashboard-message').textContent = error.message;
        $('dashboard-message').hidden = false;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('refresh-analytics')?.addEventListener('click', loadAnalytics);
    $('analytics-period')?.addEventListener('change', loadAnalytics);
    document.querySelector('a[href="#analytics"]')?.addEventListener('click', loadAnalytics);
  });
})();
