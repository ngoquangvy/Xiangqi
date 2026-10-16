import Capacitor
import UIKit

@objc(PikafishPlugin)
public class PikafishPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PikafishPlugin"
    public let jsName = "Pikafish"
    public let pluginMethods: [CAPPluginMethod] = ["analyze", "stop", "lookupBook", "status"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)! }
    private let control = DispatchQueue(label: "xiangqi.engine", qos: .userInitiated)
    private let bookQueue = DispatchQueue(label: "xiangqi.book", qos: .utility)
    private let engine = XQPikafish()
    private let book = BundledBook()
    private let gate = AnalysisGate()
    private var observers = [NSObjectProtocol]()

    public override func load() {
        engine.output = { [weak self] id, line in
            DispatchQueue.main.async {
                guard let self, self.gate.accepts(id) else { return }
                self.notifyListeners("output", data: ["id": id, "line": line])
            }
        }
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            self.gate.invalidate(active: false); self.engine.cancel()
            self.control.async { self.engine.releaseEngine() }
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.gate.invalidate(active: true)
        })
    }
    deinit { for observer in observers { NotificationCenter.default.removeObserver(observer) } }
    private func matches(_ value: String, _ pattern: String) -> Bool {
        value.range(of: pattern, options: .regularExpression) != nil
    }
    @objc func analyze(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), matches(id, "^[a-zA-Z0-9-]{1,64}$"),
              let fen = call.getString("initialFen"), fen.count <= 256,
              matches(fen, "^[rnbakcpheRNBAKCPHE1-9/]+ [wb] - - [0-9]+ [0-9]+$"),
              let moves = call.getString("moves"), moves.count <= 50000,
              matches(moves, "^(?:[a-i][0-9][a-i][0-9](?: [a-i][0-9][a-i][0-9])*)?$"),
              let profile = call.getString("profile"), ["eco", "balanced", "deep"].contains(profile) else {
            call.reject("Invalid analysis request"); return
        }
        let ticket = gate.begin(id); engine.cancel()
        control.async {
            guard self.gate.current(ticket) else { call.resolve(); return }
            do {
                let assets = try AnalysisAssets()
                let network = try assets.checkedFile("pikafish.nnue", hashKey: "nnueSha256")
                let config = try assets.profile(profile)
                guard self.gate.current(ticket) else { call.resolve(); return }
                var request: [String: Any] = config
                request.merge(["id": id, "initialFen": fen, "moves": moves, "network": network.path]) { _, new in new }
                if let error = self.engine.analyze(request) { call.reject(error) } else { call.resolve() }
            } catch { call.reject("Pikafish could not analyze", nil, error) }
        }
    }
    @objc func stop(_ call: CAPPluginCall) {
        gate.invalidate(); engine.cancel()
        control.async { call.resolve() }
    }
    @objc func lookupBook(_ call: CAPPluginCall) {
        guard let fen = call.getString("fen") else { call.reject("Missing book position"); return }
        bookQueue.async {
            do { call.resolve(["rows": try self.book.lookup(fen)]) }
            catch { call.reject("Bundled book unavailable", nil, error) }
        }
    }
    @objc func status(_ call: CAPPluginCall) {
        let (foreground, request) = gate.state()
        call.resolve(["alive": true, "searching": engine.searching(), "id": request as Any? ?? NSNull(), "foreground": foreground])
    }
}
