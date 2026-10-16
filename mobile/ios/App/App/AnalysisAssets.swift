import Foundation
import CryptoKit

final class AnalysisAssets {
    private static let lock = NSLock()
    private static var verified = Set<String>()
    private let directory: URL
    private let manifest: [String: Any]
    init() throws {
        guard let root = Bundle.main.resourceURL else { throw Self.invalid("Missing resources") }
        directory = root.appendingPathComponent("analysis")
        manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent("bundle.json"))) as? [String: Any] ?? [:]
    }
    static func invalid(_ message: String) -> NSError { NSError(domain: "Xiangqi", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    func checkedFile(_ name: String, hashKey: String) throws -> URL {
        Self.lock.lock(); defer { Self.lock.unlock() }
        let url = directory.appendingPathComponent(name)
        if Self.verified.contains(url.path) { return url }
        guard let expected = manifest[hashKey] as? String, expected.count == 64 else { throw Self.invalid("Missing asset hash") }
        let file = try FileHandle(forReadingFrom: url); defer { try? file.close() }
        var digest = SHA256()
        // Hash in chunks: never allocate an entire NNUE/book in Swift memory.
        while let chunk = try file.read(upToCount: 64 * 1024), !chunk.isEmpty { digest.update(data: chunk) }
        let actual = digest.finalize().map { String(format: "%02x", $0) }.joined()
        guard actual == expected else { throw Self.invalid("Asset checksum mismatch: \(name)") }
        Self.verified.insert(url.path)
        return url
    }
    func profile(_ name: String) throws -> [String: Int] {
        guard ["eco", "balanced", "deep"].contains(name),
              let profiles = manifest["profiles"] as? [String: [String: Int]], let config = profiles[name],
              let threads = config["threads"], (1...2).contains(threads),
              let hash = config["hash"], (16...64).contains(hash),
              let depth = config["depth"], (1...32).contains(depth),
              let time = config["milliseconds"], (1...10000).contains(time) else { throw Self.invalid("Invalid engine profile") }
        return config
    }
}
