import Foundation
import SQLite3

final class BundledBook {
    // Used only on the book queue. Never query 50 MB of JSON through WebKit.
    private var database: OpaquePointer?
    deinit { if let database { sqlite3_close(database) } }
    func lookup(_ fen: String) throws -> [[String: Any]] {
        let parts = fen.split(separator: " ")
        guard parts.count == 6, ["w", "b"].contains(String(parts[1])), fen.count <= 256 else {
            throw AnalysisAssets.invalid("Invalid book position")
        }
        if database == nil {
            let url = try AnalysisAssets().checkedFile("book.sqlite", hashKey: "bookSha256")
            guard sqlite3_open_v2(url.path, &database, SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
                if let database { sqlite3_close(database) }; database = nil
                throw AnalysisAssets.invalid("Could not open book")
            }
        }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, "SELECT candidates FROM positions WHERE fen = ?", -1, &statement, nil) == SQLITE_OK else {
            throw AnalysisAssets.invalid("Could not query book")
        }
        defer { sqlite3_finalize(statement) }
        let key = parts.prefix(2).joined(separator: " ")
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        sqlite3_bind_text(statement, 1, key, -1, transient)
        let result = sqlite3_step(statement)
        if result == SQLITE_DONE { return [] }
        guard result == SQLITE_ROW, sqlite3_column_bytes(statement, 0) <= 1024 * 1024,
              let text = sqlite3_column_text(statement, 0) else { throw AnalysisAssets.invalid("Invalid book row") }
        let data = Data(bytes: text, count: Int(sqlite3_column_bytes(statement, 0)))
        guard let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { throw AnalysisAssets.invalid("Invalid book data") }
        return rows
    }
}
