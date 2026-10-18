import Foundation

// IDs are invalidated synchronously; neither JS nor background transitions
// have to wait for an older search to finish before rejecting its output.
final class AnalysisGate {
    private let lock = NSLock()
    private var revision = 0
    private var foreground = true
    private var thermalBlocked = false
    private var request: String?
    func begin(_ id: String) -> Int {
        lock.lock(); defer { lock.unlock() }
        revision += 1; request = id
        return revision
    }
    func invalidate(active: Bool? = nil, thermal: Bool? = nil) {
        lock.lock(); defer { lock.unlock() }
        revision += 1; request = nil
        if let active { foreground = active }
        if let thermal { thermalBlocked = thermal }
    }
    func current(_ ticket: Int) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return foreground && !thermalBlocked && ticket == revision
    }
    func accepts(_ id: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return foreground && !thermalBlocked && request == id
    }
    func state() -> (Bool, String?) {
        lock.lock(); defer { lock.unlock() }
        return (foreground, request)
    }
}
