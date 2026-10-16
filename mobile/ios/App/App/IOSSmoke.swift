#if DEBUG
import WebKit

// Opt-in CI only. Release builds never evaluate a test script or expose a
// testing bridge. CI uses a fresh simulator, never someone's saved iPhone game.
enum IOSSmoke {
    static func run(webView: WKWebView?) {
        guard let webView else { write(["pass": false, "error": "Missing WKWebView"]); return }
        if webView.isLoading || webView.url == nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { run(webView: webView) }
            return
        }
        do {
            let url = Bundle.main.resourceURL!.appendingPathComponent("analysis/ios-smoke.js")
            let body = try String(contentsOf: url, encoding: .utf8)
            let restore = ProcessInfo.processInfo.arguments.contains("--xq-restore-test")
            webView.callAsyncJavaScript(body, arguments: ["restore": restore], in: nil, in: .page) { result in
                switch result {
                case .success(let value): write(value as? [String: Any] ?? ["pass": false, "error": "No smoke result"])
                case .failure(let error): write(["pass": false, "error": error.localizedDescription])
                }
            }
        } catch { write(["pass": false, "error": error.localizedDescription]) }
    }
    private static func write(_ report: [String: Any]) {
        do {
            let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("ios-smoke.json")
            try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(to: url, options: .atomic)
            print("XQ_IOS_SMOKE \(report)")
        } catch { print("XQ_IOS_SMOKE_WRITE_FAILED \(error)") }
    }
}
#endif
