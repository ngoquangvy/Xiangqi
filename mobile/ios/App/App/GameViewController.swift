import Capacitor
import AVFoundation

@objc(GameViewController)
class GameViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LocalSessionPlugin())
        bridge?.registerPluginInstance(PikafishPlugin())
        // Follow the hardware volume, but keep chess feedback audible in silent
        // mode. The app's existing sound toggle still owns the mute preference.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
    }

    #if DEBUG
    private var smokeStarted = false
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if !smokeStarted && ProcessInfo.processInfo.arguments.contains(where: { $0.hasPrefix("--xq-") }) {
            smokeStarted = true
            IOSSmoke.run(webView: webView)
        }
    }
    #endif
}
