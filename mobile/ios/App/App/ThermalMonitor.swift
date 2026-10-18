import Foundation

final class ThermalMonitor {
    var onChange: (([String: Any]) -> Void)?
    private let lock = NSLock()
    private var policy = ThermalPolicy()
    private var observer: NSObjectProtocol?
    private var timer: DispatchWorkItem?
    #if DEBUG
    private var testLevel: String?
    #endif
    func start() {
        // Apple requires reading thermalState before registering notifications.
        _ = ProcessInfo.processInfo.thermalState
        observer = NotificationCenter.default.addObserver(forName: ProcessInfo.thermalStateDidChangeNotification,
            object: nil, queue: .main) { [weak self] _ in self?.refresh() }
        refresh()
    }
    private func currentLevel() -> String {
        #if DEBUG
        if let testLevel { return testLevel }
        #endif
        switch ProcessInfo.processInfo.thermalState {
        case .nominal: return "nominal"
        case .fair: return "fair"
        case .serious: return "serious"
        case .critical: return "critical"
        @unknown default: return "serious" // Fail safe for a future heat category.
        }
    }
    private func refresh() {
        timer?.cancel(); timer = nil
        let now = ProcessInfo.processInfo.systemUptime, level = currentLevel()
        lock.lock()
        policy.update(level, now: now)
        let payload = policy.payload, deadline = policy.resumeAt
        lock.unlock()
        onChange?(payload)
        if let deadline {
            let work = DispatchWorkItem { [weak self] in self?.refresh() }
            timer = work
            DispatchQueue.main.asyncAfter(deadline: .now() + max(0.05, deadline - now), execute: work)
        }
    }
    func snapshot() -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        return policy.payload
    }
    #if DEBUG
    func simulate(_ state: String) { testLevel = state == "system" ? nil : state; refresh() }
    #endif
    deinit {
        timer?.cancel()
        if let observer { NotificationCenter.default.removeObserver(observer) }
    }
}
