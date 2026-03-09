import Cocoa
import Foundation

// MARK: - Status Data

struct StatusData: Codable {
    let state: String
    let currentApp: String
    let todayActiveSec: Int
    let lastUpdate: String
}

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var timer: Timer?
    private let statusFilePath: String
    private let reportHtmlPath: String
    private let triggerFilePath: String

    override init() {
        let args = CommandLine.arguments
        if args.count > 1 {
            statusFilePath = args[1]
        } else {
            let projectDir = URL(fileURLWithPath: #file)
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .path
            statusFilePath = projectDir + "/data/status.json"
        }
        let dataDir = URL(fileURLWithPath: statusFilePath).deletingLastPathComponent()
        reportHtmlPath = dataDir.appendingPathComponent("reports/index.html").path
        triggerFilePath = dataDir.appendingPathComponent(".report-trigger").path
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)

        if let button = statusItem.button {
            if #available(macOS 11.0, *) {
                let image = NSImage(systemSymbolName: "timer", accessibilityDescription: "TimeTracer")
                image?.size = NSSize(width: 18, height: 18)
                button.image = image
            } else {
                button.title = "TT"
            }
        }

        updateMenu(status: nil)

        // 10秒ごとにステータス更新
        timer = Timer.scheduledTimer(withTimeInterval: 10.0, repeats: true) { [weak self] _ in
            self?.refreshStatus()
        }
        // 初回即実行
        refreshStatus()
    }

    private func refreshStatus() {
        let status = loadStatus()
        DispatchQueue.main.async { [weak self] in
            self?.updateMenu(status: status)
        }
    }

    private func loadStatus() -> StatusData? {
        guard let data = FileManager.default.contents(atPath: statusFilePath),
              let status = try? JSONDecoder().decode(StatusData.self, from: data) else {
            return nil
        }

        // 30秒以上更新がなければ nil（接続なし扱い）
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let lastUpdate = formatter.date(from: status.lastUpdate) {
            if Date().timeIntervalSince(lastUpdate) > 30 {
                return nil
            }
        }

        return status
    }

    private func updateMenu(status: StatusData?) {
        let menu = NSMenu()

        if let status = status {
            // 状態表示
            let stateText: String
            if status.state == "active" && !status.currentApp.isEmpty {
                stateText = "記録中: \(status.currentApp)"
            } else if status.state == "idle" {
                stateText = "離席中"
            } else {
                stateText = "記録中"
            }
            let stateItem = NSMenuItem(title: stateText, action: nil, keyEquivalent: "")
            stateItem.isEnabled = false
            menu.addItem(stateItem)

            // 稼働時間
            let hours = status.todayActiveSec / 3600
            let minutes = (status.todayActiveSec % 3600) / 60
            let timeText = "本日: \(hours)h \(minutes)m"
            let timeItem = NSMenuItem(title: timeText, action: nil, keyEquivalent: "")
            timeItem.isEnabled = false
            menu.addItem(timeItem)
        } else {
            let noConn = NSMenuItem(title: "接続なし", action: nil, keyEquivalent: "")
            noConn.isEnabled = false
            menu.addItem(noConn)
        }

        menu.addItem(NSMenuItem.separator())

        let openReport = NSMenuItem(title: "レポートを更新して開く", action: #selector(openReport(_:)), keyEquivalent: "r")
        openReport.target = self
        menu.addItem(openReport)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "終了", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    @objc private func openReport(_ sender: NSMenuItem) {
        // トリガーファイルを作成してNode.jsにレポート生成を依頼
        FileManager.default.createFile(atPath: triggerFilePath, contents: nil)

        // トリガーが消えるのを待つ（最大10秒）
        DispatchQueue.global().async { [weak self] in
            guard let self = self else { return }
            for _ in 0..<20 {
                Thread.sleep(forTimeInterval: 0.5)
                if !FileManager.default.fileExists(atPath: self.triggerFilePath) {
                    break
                }
            }
            DispatchQueue.main.async {
                NSWorkspace.shared.open(URL(fileURLWithPath: self.reportHtmlPath))
            }
        }
    }
}

// MARK: - Main

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let delegate = AppDelegate()
app.delegate = delegate
app.run()
