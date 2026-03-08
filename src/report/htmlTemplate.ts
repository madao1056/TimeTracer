import type { AppSummary, CategorySummary, HourlyAppEntry, HourlySummary, TimelineEntry } from "../types.ts";
import { config } from "../config.ts";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CATEGORY_COLORS: Record<string, string> = {
  browser: "#4285F4",
  editor: "#34A853",
  terminal: "#1a1a2e",
  communication: "#FBBC04",
  productivity: "#9C27B0",
  media: "#EA4335",
  other: "#9E9E9E",
};

function categorize(appName: string): string {
  for (const [category, apps] of Object.entries(config.categories)) {
    if (apps.some((a) => appName.toLowerCase().includes(a.toLowerCase()))) {
      return category;
    }
  }
  return "other";
}

interface ReportInput {
  date: string;
  totalActiveSec: number;
  totalIdleSec: number;
  appSummary: AppSummary[];
  categorySummary: CategorySummary[];
  hourlySummary: HourlySummary[];
  hourlyAppBreakdown: HourlyAppEntry[];
  timeline: TimelineEntry[];
}

export function generateHtml(input: ReportInput): string {
  const {
    date,
    totalActiveSec,
    totalIdleSec,
    appSummary,
    categorySummary,
    hourlySummary,
    hourlyAppBreakdown,
    timeline,
  } = input;

  const top10 = appSummary.slice(0, 10);
  const top10Labels = JSON.stringify(top10.map((a) => a.appName));
  const top10Data = JSON.stringify(top10.map((a) => Math.round(a.totalSec / 60)));
  const top10Colors = JSON.stringify(
    top10.map((a) => CATEGORY_COLORS[a.category] ?? CATEGORY_COLORS.other)
  );

  const catLabels = JSON.stringify(categorySummary.map((c) => c.category));
  const catData = JSON.stringify(categorySummary.map((c) => Math.round(c.totalSec / 60)));
  const catColors = JSON.stringify(
    categorySummary.map((c) => CATEGORY_COLORS[c.category] ?? CATEGORY_COLORS.other)
  );

  const activeHourly = hourlySummary.filter((h) => h.totalSec > 0);
  const hourLabels = JSON.stringify(activeHourly.map((h) => `${h.hour}:00`));
  const hourData = JSON.stringify(activeHourly.map((h) => Math.round(h.totalSec / 60)));

  // タイムライン帯グラフ用データ: 1時間ごとのアプリ別分数
  const activeHours = hourlySummary.filter((h) => h.totalSec > 0).map((h) => h.hour);
  const tlHourLabels = JSON.stringify(activeHours.map((h) => `${h}:00`));

  // 各時間帯で使われたアプリを集計
  const hourAppMap = new Map<number, Map<string, number>>();
  for (const entry of hourlyAppBreakdown) {
    if (!hourAppMap.has(entry.hour)) hourAppMap.set(entry.hour, new Map());
    hourAppMap.get(entry.hour)!.set(entry.appName, Math.round(entry.totalSec / 60));
  }

  // 全時間帯で使われたアプリのユニークリスト（使用時間降順）
  const appTotalMap = new Map<string, number>();
  for (const entry of hourlyAppBreakdown) {
    appTotalMap.set(entry.appName, (appTotalMap.get(entry.appName) ?? 0) + entry.totalSec);
  }
  const tlApps = Array.from(appTotalMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);

  // アプリごとの色を割り当て
  const APP_PALETTE = ["#4285F4", "#34A853", "#FBBC04", "#EA4335", "#9C27B0", "#00BCD4", "#FF9800", "#795548"];
  const tlDatasets = JSON.stringify(
    tlApps.map((appName, i) => ({
      label: appName,
      data: activeHours.map((h) => hourAppMap.get(h)?.get(appName) ?? 0),
      backgroundColor: CATEGORY_COLORS[categorize(appName)] ?? APP_PALETTE[i % APP_PALETTE.length],
      borderRadius: 2,
    }))
  );

  const timelineRows = timeline
    .filter((t) => t.durationSec >= 10)
    .slice(0, 100)
    .map(
      (t) =>
        `<tr>
          <td>${escapeHtml(t.appName)}</td>
          <td>${new Date(t.startTime).toLocaleTimeString("ja-JP")}</td>
          <td>${new Date(t.endTime).toLocaleTimeString("ja-JP")}</td>
          <td>${formatDuration(t.durationSec)}</td>
        </tr>`
    )
    .join("\n");

  const appTableRows = appSummary
    .slice(0, 20)
    .map(
      (a, i) =>
        `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(a.appName)}</td>
          <td>${a.category}</td>
          <td>${formatDuration(a.totalSec)}</td>
        </tr>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TimeTracer Report - ${escapeHtml(date)}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.8rem; margin-bottom: 8px; }
    h2 { font-size: 1.3rem; margin: 24px 0 12px; border-bottom: 2px solid #ddd; padding-bottom: 4px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 16px 0; }
    .card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card .label { font-size: 0.85rem; color: #666; }
    .card .value { font-size: 1.6rem; font-weight: bold; margin-top: 4px; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 16px 0; }
    .chart-box { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .full-width { grid-column: 1 / -1; }
    canvas { max-height: 350px; }
    #timelineChart { max-height: 400px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #fafafa; font-weight: 600; font-size: 0.85rem; color: #666; }
    td { font-size: 0.9rem; }
    @media (max-width: 768px) { .charts { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>TimeTracer 日次レポート</h1>
    <p style="color: #666;">${escapeHtml(date)}</p>

    <div class="summary">
      <div class="card">
        <div class="label">稼働時間</div>
        <div class="value">${formatDuration(totalActiveSec)}</div>
      </div>
      <div class="card">
        <div class="label">離席時間</div>
        <div class="value">${formatDuration(totalIdleSec)}</div>
      </div>
      <div class="card">
        <div class="label">使用アプリ数</div>
        <div class="value">${appSummary.length}</div>
      </div>
    </div>

    <div class="charts">
      <div class="chart-box">
        <h2 style="border:none;margin:0 0 12px;">TOP 10 アプリ（分）</h2>
        <canvas id="appChart"></canvas>
      </div>
      <div class="chart-box">
        <h2 style="border:none;margin:0 0 12px;">カテゴリ別</h2>
        <canvas id="catChart"></canvas>
      </div>
      <div class="chart-box full-width">
        <h2 style="border:none;margin:0 0 12px;">時間帯別アクティビティ（分）</h2>
        <canvas id="hourChart"></canvas>
      </div>
    </div>

    <div class="charts">
      <div class="chart-box full-width">
        <h2 style="border:none;margin:0 0 12px;">タイムライン</h2>
        <canvas id="timelineChart"></canvas>
      </div>
    </div>

    <h2>アプリランキング</h2>
    <table>
      <thead><tr><th>#</th><th>アプリ</th><th>カテゴリ</th><th>時間</th></tr></thead>
      <tbody>${appTableRows}</tbody>
    </table>

    <h2>詳細ログ</h2>
    <details>
      <summary style="cursor:pointer;padding:8px 0;font-size:0.9rem;color:#666;">全セッション一覧を表示</summary>
      <table>
        <thead><tr><th>アプリ</th><th>開始</th><th>終了</th><th>時間</th></tr></thead>
        <tbody>${timelineRows}</tbody>
      </table>
    </details>

    <p style="text-align:center;color:#999;margin-top:24px;font-size:0.8rem;">
      Generated by TimeTracer at ${new Date().toLocaleString("ja-JP")}
    </p>
  </div>

  <script>
    new Chart(document.getElementById('appChart'), {
      type: 'bar',
      data: {
        labels: ${top10Labels},
        datasets: [{
          data: ${top10Data},
          backgroundColor: ${top10Colors},
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, title: { display: true, text: '分' } } }
      }
    });

    new Chart(document.getElementById('catChart'), {
      type: 'doughnut',
      data: {
        labels: ${catLabels},
        datasets: [{
          data: ${catData},
          backgroundColor: ${catColors}
        }]
      },
      options: {
        plugins: { legend: { position: 'right' } }
      }
    });

    new Chart(document.getElementById('hourChart'), {
      type: 'bar',
      data: {
        labels: ${hourLabels},
        datasets: [{
          data: ${hourData},
          backgroundColor: '#4285F4',
          borderRadius: 4
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: '時間帯' } },
          y: { beginAtZero: true, title: { display: true, text: '分' } }
        }
      }
    });

    new Chart(document.getElementById('timelineChart'), {
      type: 'bar',
      data: {
        labels: ${tlHourLabels},
        datasets: ${tlDatasets}
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + ctx.raw + '分';
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            max: 60,
            title: { display: true, text: '分' }
          },
          y: { stacked: true }
        },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  </script>
</body>
</html>`;
}
