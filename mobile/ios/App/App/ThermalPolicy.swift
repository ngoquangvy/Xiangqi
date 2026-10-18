import Foundation

// Pure, clock-driven policy. After high heat, require ten stable nominal
// seconds; fair/serious transitions must not repeatedly restart a hot engine.
struct ThermalPolicy {
    private(set) var level = "nominal"
    private(set) var blocked = false
    private(set) var limited = false
    private(set) var revision = 0
    private(set) var resumeAt: TimeInterval?
    mutating func update(_ value: String, now: TimeInterval) {
        let previous = "\(level)|\(blocked)|\(limited)"
        if value == "serious" || value == "critical" { blocked = true }
        if value != "nominal" { resumeAt = nil; limited = true }
        else if limited {
            if resumeAt == nil { resumeAt = now + 10 }
            if now >= resumeAt! { blocked = false; limited = false; resumeAt = nil }
        }
        level = (limited && value == "nominal") || (blocked && value == "fair") ? "cooling" : value
        if previous != "\(level)|\(blocked)|\(limited)" { revision += 1 }
    }
    var payload: [String: Any] { ["state": level, "blocked": blocked, "limited": limited, "revision": revision] }
}
