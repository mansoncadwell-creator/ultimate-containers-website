
$ErrorActionPreference = 'Stop'

$adminPath = '.\routes\admin.js'
$htmlPath = '.\admin-ui\index.html'
$jsPath = '.\admin-ui\analytics.js'

# Create backups
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item $adminPath "$adminPath.backup-$stamp"
Copy-Item $htmlPath "$htmlPath.backup-$stamp"
Copy-Item $jsPath "$jsPath.backup-$stamp"

# Replace the existing analytics endpoint
$admin = Get-Content $adminPath -Raw
$start = $admin.IndexOf("router.get('/analytics'")
$end = $admin.IndexOf('module.exports=router;', $start)

if ($start -lt 0 -or $end -lt 0) {
    throw 'Could not locate the analytics endpoint. No backend changes made.'
}

$route = @'
router.get('/analytics',requireAdmin,(req,res)=>{
 try {
  const count = sql => db.prepare(sql).get().n;
  const stats = {
   totalViews: count("SELECT COUNT(*) n FROM analytics_events WHERE event_type='page_view'"),
   uniqueVisitors: count("SELECT COUNT(*) n FROM analytics_visitors"),
   totalSessions: count("SELECT COUNT(*) n FROM analytics_sessions"),
   visitorsToday: count("SELECT COUNT(*) n FROM analytics_visitors WHERE date(first_seen)=date('now','localtime')"),
   viewsToday: count("SELECT COUNT(*) n FROM analytics_events WHERE event_type='page_view' AND date(created_at,'localtime')=date('now','localtime')")
  };

  const days = [7,30,90,365].includes(Number(req.query.days))
    ? Number(req.query.days) : 7;
  const modifier = `-${days - 1} days`;

  const trend = db.prepare(`
   WITH RECURSIVE dates(day) AS (
    SELECT date('now','localtime',?)
    UNION ALL
    SELECT date(day,'+1 day') FROM dates
    WHERE day < date('now','localtime')
   )
   SELECT dates.day,
    COUNT(e.id) views,
    COUNT(DISTINCT e.visitor_id) visitors
   FROM dates
   LEFT JOIN analytics_events e
    ON date(e.created_at,'localtime')=dates.day
    AND e.event_type='page_view'
   GROUP BY dates.day
   ORDER BY dates.day
  `).all(modifier);

  const chartPages = db.prepare(`
   SELECT page_path,COUNT(*) views
   FROM analytics_events
   WHERE event_type='page_view'
    AND date(created_at,'localtime') >= date('now','localtime',?)
   GROUP BY page_path ORDER BY views DESC LIMIT 10
  `).all(modifier);

  const chartDevices = db.prepare(`
   SELECT device_type,COUNT(*) total
   FROM analytics_events
   WHERE event_type='page_view'
    AND date(created_at,'localtime') >= date('now','localtime',?)
   GROUP BY device_type ORDER BY total DESC
  `).all(modifier);

  const chartReferrals = db.prepare(`
   SELECT CASE WHEN referrer_domain=''
    THEN 'Direct' ELSE referrer_domain END source,
    COUNT(*) total
   FROM analytics_events
   WHERE event_type='page_view'
    AND date(created_at,'localtime') >= date('now','localtime',?)
   GROUP BY source ORDER BY total DESC LIMIT 10
  `).all(modifier);

  const pages = db.prepare("SELECT page_path,COUNT(*) views FROM analytics_events WHERE event_type='page_view' GROUP BY page_path ORDER BY views DESC LIMIT 10").all();
  const devices = db.prepare("SELECT device_type,COUNT(*) total FROM analytics_events WHERE event_type='page_view' GROUP BY device_type ORDER BY total DESC").all();
  const referrals = db.prepare("SELECT CASE WHEN referrer_domain='' THEN 'Direct' ELSE referrer_domain END source,COUNT(*) total FROM analytics_events WHERE event_type='page_view' GROUP BY source ORDER BY total DESC LIMIT 10").all();
  const recent = db.prepare("SELECT page_path,device_type,event_type,created_at FROM analytics_events ORDER BY id DESC LIMIT 20").all();

  res.json({
   success:true,stats,pages,devices,referrals,recent,
   charts:{trend,pages:chartPages,devices:chartDevices,referrals:chartReferrals}
  });
 } catch(err) {
  console.error('Admin analytics error:',err.message);
  res.status(500).json({success:false,message:'Could not load analytics.'});
 }
});
'@

$admin = $admin.Substring(0,$start) + $route + "`n" + $admin.Substring($end)
Set-Content $adminPath $admin -Encoding UTF8

# Add chart area to the analytics section
$html = Get-Content $htmlPath -Raw

$chartMarkup = @'
<div id="analytics-chart-controls" style="margin:20px 0">
 <label for="analytics-period">Chart date range: </label>
 <select id="analytics-period">
  <option value="7">Last 7 days</option>
  <option value="30">Last 30 days</option>
  <option value="90">Last 90 days</option>
  <option value="365">Last 12 months</option>
 </select>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin:20px 0">
 <div class="admin-stat"><h3>Traffic over time</h3><canvas id="traffic-chart"></canvas></div>
 <div class="admin-stat"><h3>Visitor devices</h3><canvas id="device-chart"></canvas></div>
 <div class="admin-stat"><h3>Most visited pages</h3><canvas id="pages-chart"></canvas></div>
 <div class="admin-stat"><h3>Traffic sources</h3><canvas id="sources-chart"></canvas></div>
</div>
'@

if (-not $html.Contains('id="analytics-chart-controls"')) {
 $anchor = '<h3>Most visited pages</h3>'
 if (-not $html.Contains($anchor)) {
  throw 'Could not find the analytics chart insertion point.'
 }
 $html = $html.Replace($anchor,$chartMarkup + $anchor)
}

# Load Chart.js and the analytics chart controller
$oldScripts = '<script src="admin.js" defer></script>'
$newScripts = '<script src="admin.js" defer></script><script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script><script src="analytics.js" defer></script>'

if (-not $html.Contains('src="analytics.js"')) {
 if (-not $html.Contains($oldScripts)) {
  throw 'Could not find the admin.js script tag.'
 }
 $html = $html.Replace($oldScripts,$newScripts)
}

Set-Content $htmlPath $html -Encoding UTF8

# Write the analytics chart controller
$analyticsJs = @'
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
'@

Set-Content $jsPath $analyticsJs -Encoding UTF8

# Validate the updated JavaScript
node --check $adminPath
if ($LASTEXITCODE -ne 0) { throw 'Backend JavaScript validation failed.' }

node --check $jsPath
if ($LASTEXITCODE -ne 0) { throw 'Analytics JavaScript validation failed.' }

Write-Host ''
Write-Host 'Analytics charts installed and JavaScript checks passed.' -ForegroundColor Green
Write-Host "Backups created with suffix: $stamp"
