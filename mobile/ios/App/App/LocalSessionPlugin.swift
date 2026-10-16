import Capacitor
import Foundation

@objc(LocalSessionPlugin)
public class LocalSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocalSessionPlugin"
    public let jsName = "LocalSession"
    public let pluginMethods = [CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
                                CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)]
    private let queue = DispatchQueue(label: "xiangqi.session")

    private func location() throws -> URL {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                    appropriateFor: nil, create: true)
        return directory.appendingPathComponent("xiangqi-session-v1.json")
    }
    @objc func get(_ call: CAPPluginCall) {
        queue.async {
            do {
                let url = try self.location()
                if !FileManager.default.fileExists(atPath: url.path) { call.resolve(["value": NSNull()]); return }
                let data = try Data(contentsOf: url)
                guard data.count <= 512 * 1024, let value = String(data: data, encoding: .utf8) else {
                    call.reject("Invalid saved session"); return
                }
                call.resolve(["value": value])
            } catch { call.reject("Could not read session", nil, error) }
        }
    }
    @objc func set(_ call: CAPPluginCall) {
        guard let value = call.getString("value"), let data = value.data(using: .utf8), data.count <= 512 * 1024 else {
            call.reject("Invalid or oversized session"); return
        }
        queue.async {
            do {
                // Atomic replacement protects the last complete game if iOS
                // terminates the app. Resolve only AFTER the write succeeds.
                try data.write(to: self.location(), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                call.resolve()
            } catch { call.reject("Could not persist session", nil, error) }
        }
    }
}
