# アプリ使用時間トラッカー 仕様書

## 1. 概要

### 1-1. プロダクト名
**TimeTracer** ─ バックグラウンドで動くアプリ使用時間トラッカー

### 1-2. コンセプト
PCで「今どのアプリをどれだけ使っているか」をバックグラウンドで自動計測し、毎日のレポートを生成する自己管理ツール。意識せず裏で動き、1日の終わりに「今日の使い方」が見える。

### 1-3. 解決する課題
- 「今日一日何やってたっけ？」がわからない
- 作業時間の見積もり精度が低い
- SNSやブラウジングに想像以上の時間を使っている可能性
- クライアントワークの稼働時間を客観的に把握したい

### 1-4. 対象ユーザー
- 自分自身（まず自分で使う前提）
- フリーランス / ディレクター / マルチタスクワーカー

---

## 2. 機能要件

### 2-1. コア機能：アクティブウィンドウの自動追跡

| 項目 | 仕様 |
|------|------|
| 計測方法 | 一定間隔（5秒ごと）でアクティブウィンドウ（最前面のアプリ）を取得 |
| 取得する情報 | アプリ名、ウィンドウタイトル、開始時刻、終了時刻 |
| 切り替え検知 | 前回と異なるアプリが最前面に来たタイミングで「セッション」を区切る |
| アイドル検知 | 5分間操作なし（`ioreg` の HIDIdleTime で判定）で「idle」として記録 |
| 動作 | 完全バックグラウンド。UIなし、通知なし |

**ウィンドウ情報の取得方法（macOS）：**
- AppleScript（`osascript`）を `execSync` で実行
- `System Events` から最前面アプリのアプリ名・ウィンドウタイトルを取得
- アクセシビリティ権限が必要

**セッションの定義：**
```
1つのアプリが最前面にある連続した時間 = 1セッション
例: VSCode を 14:00〜14:45 まで使用 → 1セッション（45分）
```

### 2-2. スリープ連動（一時停止 / 自動再開）

PCがスリープに入ったらトラッキングを一時停止し、復帰したら自動で再開する。

**検知方式: ポーリング間隔のギャップ検出**

OS通知APIを使わず、前回ポーリングからの経過時間で判定するシンプルなアプローチ。

| 条件 | 動作 |
|------|------|
| 前回pollからの経過時間 ≥ `sleepGapThresholdMs`（デフォルト: 30秒） | スリープ/復帰があったとみなす |
| 検出時 | 現在のセッションを前回poll時刻で閉じてDB保存 → 新しいセッションを開始 |

**処理フロー：**
```
ポーリング実行
 │
 ├── gap = now - lastPollTime
 │
 ├── gap >= sleepGapThresholdMs の場合
 │     ├── 現在のセッションを lastPollTime で閉じてDB保存
 │     ├── current = null（リセット）
 │     └── 新しいセッションを開始
 │
 └── gap < sleepGapThresholdMs の場合
       └── 通常のセッション更新処理
```

### 2-3. 日次レポート生成

毎日指定時刻（デフォルト: 23:55）に、その日の計測データからHTMLレポートを自動生成する。

**レポートに含める内容：**

| セクション | 内容 |
|-----------|------|
| サマリー | 総稼働時間、離席時間、使用アプリ数 |
| TOP 10 アプリ | 使用時間の多い順にアプリ名・時間を横棒グラフで表示 |
| カテゴリ別集計 | ドーナツチャートでカテゴリごとの割合を可視化 |
| 時間帯別アクティビティ | 1時間ごとの稼働時間を棒グラフで表示 |
| タイムライン | 1時間ごとの帯グラフでどのアプリを使っていたか色分け表示 |
| 詳細ログ | 全セッション一覧テーブル（折りたたみ） |

**レポートの出力先：**
```
<プロジェクトルート>/data/reports/report-YYYY-MM-DD.html
```

### 2-4. アプリのカテゴリ分類

設定ファイル（`config.json`）でアプリをカテゴリに分類できる。未分類のアプリは `other` に自動振り分け。

カテゴリ分類はアプリ名の部分一致で判定する（大文字小文字を区別しない）。

```json
{
  "categories": {
    "browser": ["Google Chrome", "Safari", "Firefox", "Arc"],
    "editor": ["Code", "Visual Studio Code", "Cursor"],
    "terminal": ["Terminal", "iTerm2", "Warp"],
    "communication": ["Slack", "Discord", "Zoom", "LINE"],
    "productivity": ["Notion", "Obsidian", "Calendar"],
    "media": ["Spotify", "Music", "YouTube"]
  }
}
```

### 2-5. 除外設定（v1未実装 / 将来対応予定）

> **Note:** この機能はv1では未実装。将来のバージョンで対応予定。

計測から除外するアプリやウィンドウタイトルを設定可能にする。

```json
{
  "exclude": {
    "apps": ["Finder", "SystemUIServer"],
    "windowTitlesContain": ["パスワード", "password"]
  }
}
```

---

## 3. 非機能要件

| 項目 | 仕様 |
|------|------|
| 対応OS | macOS 12以降 |
| CPU負荷 | 常時 1%未満（5秒ポーリング + AppleScript で軽量） |
| メモリ使用量 | 50MB以下 |
| ストレージ | 1日あたり約 100KB（SQLite） |
| プライバシー | すべてのデータはローカル保存。外部送信一切なし |
| 起動 | OS起動時に自動起動（launchd） |

---

## 4. 技術構成

### 4-1. 全体アーキテクチャ

```
┌─────────────────────────────────────────┐
│             TimeTracer                   │
│                                          │
│  ┌──────────┐    ┌──────────┐            │
│  │ Tracker  │───▶│ SQLite   │            │
│  │ (常駐)   │    │ DB       │            │
│  └──────────┘    └────┬─────┘            │
│       │               │                  │
│       │          ┌────▼─────┐            │
│       │          │ Reporter │            │
│       │          │ (定時)   │            │
│       │          └────┬─────┘            │
│       │               │                  │
│       │          ┌────▼─────┐            │
│       │          │ HTML     │            │
│       │          │ レポート  │            │
│       │          └──────────┘            │
│       │                                  │
│  ┌────▼─────┐                            │
│  │ Config   │  ← config.json             │
│  │ (設定)   │                            │
│  └──────────┘                            │
└─────────────────────────────────────────┘
```

### 4-2. 技術スタック

| レイヤー | 技術 | 選定理由 |
|---------|------|---------|
| 言語 | TypeScript 5.7+ | 型安全、Node.jsエコシステム |
| ランタイム | Node.js + tsx | TypeScriptを直接実行 |
| ウィンドウ取得 | AppleScript via `execSync` | macOS標準、追加依存なし |
| アイドル検知 | `ioreg -c IOHIDSystem` | HIDIdleTimeをナノ秒単位で取得、追加依存なし |
| スリープ検知 | ポーリング間隔ギャップ検出 | OS API不要、シンプル |
| データ保存 | better-sqlite3 | 高速な同期API、WALモード対応 |
| スケジューラ | `setTimeout` | 標準API、追加依存なし |
| レポート生成 | テンプレートリテラル + Chart.js | HTML内にグラフを埋め込み |
| 自動起動 | launchd（bash script） | OS標準の仕組みで確実 |
| モジュール | ES2022 modules | `"type": "module"` |

### 4-3. ディレクトリ構成

```
TimeTracer/
├── package.json          # プロジェクト設定・依存管理
├── tsconfig.json         # TypeScript設定
├── config.json           # ユーザー設定
├── src/
│   ├── index.ts          # エントリーポイント
│   ├── config.ts         # 設定読み込み・定数
│   ├── types.ts          # 型定義
│   ├── db.ts             # SQLite操作
│   ├── tracker.ts        # トラッキングオーケストレーター
│   ├── macos/
│   │   ├── activeWindow.ts  # AppleScriptでアクティブウィンドウ取得
│   │   └── idleTime.ts      # ioregでアイドル時間取得
│   ├── session/
│   │   └── sessionManager.ts  # セッション状態管理・DB書き込み
│   └── report/
│       ├── reportGenerator.ts  # レポート生成メイン
│       ├── reportData.ts       # DBからの集計クエリ
│       ├── htmlTemplate.ts     # HTMLテンプレート生成
│       └── scheduler.ts        # 日次レポートスケジューラ
├── scripts/
│   ├── install.sh        # launchd自動起動登録
│   └── uninstall.sh      # launchd自動起動解除
├── data/
│   ├── timetracer.db     # SQLiteデータベース
│   └── reports/          # 日次レポート出力先
│       └── report-YYYY-MM-DD.html
└── docs/
    └── spec.md           # 本仕様書
```

### 4-4. データベース設計

**テーブル: `tracking_records`**

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER (PK, AUTOINCREMENT) | 自動連番 |
| app_name | TEXT NOT NULL | アプリ名（例: "Google Chrome"） |
| window_title | TEXT NOT NULL | ウィンドウタイトル（例: "Gmail - 受信トレイ"） |
| start_time | TEXT NOT NULL | セッション開始時刻（ISO 8601） |
| end_time | TEXT NOT NULL | セッション終了時刻（ISO 8601） |
| duration_sec | REAL NOT NULL | 継続秒数 |
| session_type | TEXT NOT NULL | `'active'` または `'idle'` |
| date | TEXT NOT NULL | 日付（`YYYY-MM-DD`、集計用） |

**CHECK制約:**
```sql
CHECK(session_type IN ('active', 'idle'))
```

**インデックス:**
```sql
CREATE INDEX idx_date ON tracking_records(date);
CREATE INDEX idx_app_date ON tracking_records(app_name, date);
```

**SQLite設定:**
```sql
PRAGMA journal_mode = WAL;     -- 並行読み取り性能向上
PRAGMA busy_timeout = 5000;    -- ロック待機5秒
```

---

## 5. 処理フロー

### 5-1. トラッキングのフロー

```
起動（npm run dev）
 │
 ▼
Tracker.start() → setInterval で5秒ごとにpoll
 │
 ▼
SessionManager.update(window, idleMs, now)
 │
 ├── スリープ検出（gap >= sleepGapThresholdMs）
 │     ├── 現在のセッションを前回poll時刻で閉じてDB保存
 │     └── current = null
 │
 ├── ウィンドウ取得失敗 → lastPollTimeのみ更新して継続
 │
 ├── アイドル判定（idleMs >= idleThresholdMs）
 │     ├── 前のセッションを閉じてDB保存
 │     └── session_type = 'idle' の新セッション開始
 │
 ├── アプリ切り替え（appName が変わった）
 │     ├── 前のセッションを閉じてDB保存
 │     └── 新しいセッション開始
 │
 └── 同一セッション継続
       └── windowTitle と lastPollTime を更新
```

### 5-2. レポート生成のフロー

```
ReportScheduler.start()
 │
 ▼
setTimeout で reportTime（23:55）まで待機
 │
 ▼
generateReport(date)
 │
 ├── getAppSummary(date)         → アプリ別集計
 ├── getCategorySummary(date)    → カテゴリ別集計
 ├── getHourlySummary(date)      → 時間帯別集計
 ├── getTimeline(date)           → タイムライン
 ├── getTotalActiveSec(date)     → 総稼働時間
 └── getTotalIdleSec(date)       → 総離席時間
 │
 ▼
generateHtml(data) → HTMLテンプレートにデータ埋め込み
 │
 ▼
data/reports/report-YYYY-MM-DD.html として保存
 │
 ▼
翌日分を再スケジュール
```

### 5-3. シャットダウンフロー

```
SIGINT / SIGTERM 受信
 │
 ├── tracker.stop()       → ポーリング停止、現在セッションをDB保存
 ├── scheduler.stop()     → レポートスケジューラ停止
 └── closeDb()            → SQLiteクローズ
```

---

## 6. レポートのイメージ

### 6-1. サマリーセクション

```
╔═══════════════════════════════════════╗
║  TimeTracer 日次レポート               ║
║  2026-03-07                           ║
╠═══════════════════════════════════════╣
║                                       ║
║  稼働時間      8h 32m                 ║
║  離席時間      1h 15m                 ║
║  使用アプリ数  12                      ║
║                                       ║
╚═══════════════════════════════════════╝
```

### 6-2. TOP 10 アプリ（横棒グラフ）

Chart.js の横棒グラフ（`indexAxis: 'y'`）で分単位表示。

```
 Visual Studio Code   ████████████████░░░  222m
 Google Chrome         ████████░░░░░░░░░░░  118m
 Slack                 ████░░░░░░░░░░░░░░░   45m
 Figma                 ███░░░░░░░░░░░░░░░░   38m
 Terminal              ███░░░░░░░░░░░░░░░░   32m
 ...
```

### 6-3. カテゴリ別ドーナツチャート

Chart.js の `doughnut` チャート。各カテゴリに固定色を割り当て。

| カテゴリ | 色 |
|---------|-----|
| browser | #4285F4 |
| editor | #34A853 |
| terminal | #1a1a2e |
| communication | #FBBC04 |
| productivity | #9C27B0 |
| media | #EA4335 |
| other | #9E9E9E |

### 6-4. タイムライン（帯グラフ）

1時間ごとにChart.jsの横棒（stacked horizontal bar）で、何のアプリを使っていたかを色分け表示。

```
09:00 ████ VSCode ██ Chrome █ Slack
10:00 █████████ VSCode █ Terminal
11:00 ███ Chrome ████ Figma ██ Slack
12:00 ░░░░░░░ 離席 ░░░░░░░░░░░░░░
13:00 ████████ VSCode ██ Terminal
...
```

---

## 7. 設定ファイル（config.json）

```json
{
  "pollIntervalMs": 5000,
  "idleThresholdMs": 300000,
  "sleepGapThresholdMs": 30000,
  "reportTime": "23:55",
  "categories": {
    "browser": [
      "Google Chrome",
      "Safari",
      "Firefox",
      "Arc",
      "Brave Browser",
      "Microsoft Edge"
    ],
    "editor": [
      "Code",
      "Visual Studio Code",
      "Cursor",
      "Xcode",
      "IntelliJ IDEA",
      "WebStorm"
    ],
    "terminal": [
      "Terminal",
      "iTerm2",
      "Warp",
      "Alacritty",
      "kitty"
    ],
    "communication": [
      "Slack",
      "Discord",
      "Microsoft Teams",
      "Zoom",
      "LINE",
      "Messages"
    ],
    "productivity": [
      "Notion",
      "Obsidian",
      "Notes",
      "Reminders",
      "Calendar",
      "Finder"
    ],
    "media": [
      "Spotify",
      "Music",
      "YouTube",
      "VLC",
      "QuickTime Player"
    ]
  }
}
```

| キー | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| pollIntervalMs | number | 5000 | ポーリング間隔（ミリ秒） |
| idleThresholdMs | number | 300000 | アイドル判定閾値（ミリ秒、5分） |
| sleepGapThresholdMs | number | 30000 | スリープ判定閾値（ミリ秒、30秒） |
| reportTime | string | "23:55" | 日次レポート生成時刻（HH:MM） |
| categories | Record<string, string[]> | {} | カテゴリ→アプリ名の対応 |

---

## 8. セットアップ手順

### 8-1. 初回インストール

```bash
# 1. リポジトリをクローン or ダウンロード
git clone https://github.com/your-name/timetracer.git
cd timetracer

# 2. 依存パッケージをインストール
npm install

# 3. 設定ファイルをカスタマイズ
# config.json を自分のアプリに合わせて編集

# 4. 動作確認
npm run dev

# 5. 自動起動を登録
npm run install-daemon
```

### 8-2. macOS の権限設定（重要）

macOS ではアクティブウィンドウの取得に以下の権限が必要：

1. **システム設定 → プライバシーとセキュリティ → アクセシビリティ**
   - Terminal（またはiTerm2等）を許可リストに追加
   - デーモン実行時は `tsx` / `node` も追加が必要
2. **システム設定 → プライバシーとセキュリティ → オートメーション**
   - System Events へのアクセスを許可

### 8-3. npmスクリプト

```bash
npm run dev              # 開発用：トラッカー起動
npm run report           # レポート手動生成（当日分）
npm run report 2026-03-07  # 指定日のレポート生成
npm run install-daemon   # launchd自動起動登録
npm run uninstall-daemon # launchd自動起動解除
```

---

## 9. macOS 自動起動の仕組み（launchd）

`scripts/install.sh` が `~/Library/LaunchAgents/com.timetracer.daemon.plist` を生成し登録する。

**plistの主要設定：**

| キー | 値 | 説明 |
|------|-----|------|
| Label | `com.timetracer.daemon` | サービス識別子 |
| ProgramArguments | `tsx src/index.ts` | 実行コマンド |
| WorkingDirectory | プロジェクトルート | 作業ディレクトリ |
| RunAtLoad | true | ログイン時に自動起動 |
| KeepAlive | true | クラッシュ時に自動再起動 |
| StandardOutPath | `data/timetracer.log` | 標準出力ログ |
| StandardErrorPath | `data/timetracer-error.log` | エラーログ |

**アンインストール:**
```bash
npm run uninstall-daemon  # plist削除 + launchctl unload
```

---

## 10. 将来の拡張案（v2以降）

| 優先度 | 機能 | 概要 |
|--------|------|------|
| ★★★ | Windows対応 | Windows用のアクティブウィンドウ取得・アイドル検知を実装 |
| ★★★ | 除外設定（exclude） | 特定アプリ・ウィンドウタイトルをトラッキングから除外 |
| ★★★ | 週次・月次レポート | 週単位・月単位の傾向を可視化 |
| ★★☆ | ブラウザ別URL追跡 | Chrome拡張と連携してサイト別の時間を取得 |
| ★★☆ | Slack/Discord通知 | 日次レポートのサマリーを自動投稿 |
| ★★☆ | 目標設定 | 「editorアプリ6時間以上」等の目標に対する達成率 |
| ★☆☆ | スマホ連携 | iOSスクリーンタイムとの連携 |
| ★☆☆ | AIサマリー | Claude APIで「今日の働き方」を自然言語で要約 |

---

## 11. 開発ロードマップ

### Phase 1：MVP ✅
- アクティブウィンドウの取得と記録
- SQLiteへの保存
- セッション管理

### Phase 2：レポート ✅
- HTML日次レポート生成
- Chart.jsでグラフ表示（棒グラフ・ドーナツチャート）
- カテゴリ分類

### Phase 3：常駐化 ✅
- OS起動時の自動起動設定（launchd）
- アイドル検知
- スリープ検知（ギャップ検出方式）

### Phase 4：磨き込み（進行中）
- レポートの日本語化
- タイムライン帯グラフの実装
- 設定のGUI化
- エラーハンドリング強化

---

## 12. 依存パッケージ

**dependencies:**
```json
{
  "better-sqlite3": "^11.7.0"
}
```

**devDependencies:**
```json
{
  "@types/better-sqlite3": "^7.6.12",
  "@types/node": "^22.10.0",
  "tsx": "^4.19.0",
  "typescript": "^5.7.0"
}
```

**レポート表示用（CDN）：**
- Chart.js v4（`https://cdn.jsdelivr.net/npm/chart.js@4`）

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|------|-----------|------|
| 2026-03-07 | v1.0 | 初版作成（Python版） |
| 2026-03-08 | v2.0 | TypeScript版に全面改訂。実装に合わせて技術スタック・DB設計・ディレクトリ構成等を更新 |
