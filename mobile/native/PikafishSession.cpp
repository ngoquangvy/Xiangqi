#include "PikafishSession.h"
#include <array>
#include <chrono>
#include <sstream>
#include "bitboard.h"
#include "position.h"
#include "misc.h"
#include "uci.h"

PikafishSession::PikafishSession(Output callback) : output(std::move(callback)) {}

PikafishSession::~PikafishSession() { release(); }

void PikafishSession::cancel() {
    generation.fetch_add(1);
    // No initialization, allocation, wait or filesystem work under this lock.
    // Once go starts, stop only changes the engine's atomic stop flag.
    std::lock_guard<std::mutex> lock(gate);
    if (active.load()) engine->stop();
}

void PikafishSession::release() {
    cancel();
    if (engine) engine->wait_for_search_finished();
    active.store(false);
    engine.reset();
}

void PikafishSession::analyze(const std::string& id, const std::string& fen,
                             const std::string& moves, const std::string& network, Config config) {
    const auto ticket = generation.load();
    static std::once_flag initialized;
    std::call_once(initialized, [] { Stockfish::Bitboards::init(); Stockfish::Position::init(); });
    if (!engine) engine = std::make_unique<Stockfish::Engine>();
    std::array<std::string, XQ_VARIATION_COUNT> latest{};
    std::array<std::chrono::steady_clock::time_point, XQ_VARIATION_COUNT> last{};
    const auto emit = [&](const std::string& line) {
        if (generation.load() == ticket) output(id, line);
    };
    engine->set_on_update_no_moves([](const Stockfish::Engine::InfoShort&) {});
    engine->set_on_iter([](const Stockfish::Engine::InfoIter&) {});
    engine->set_on_verify_networks([](std::string_view) {});
    engine->set_on_update_full([&](const Stockfish::Engine::InfoFull& info) {
        if (info.multiPV < 1 || info.multiPV > XQ_VARIATION_COUNT) return;
        const auto index = info.multiPV - 1;
        std::ostringstream line;
        line << "info depth " << info.depth << " multipv " << info.multiPV
             << " score " << Stockfish::UCIEngine::format_score(info.score);
        if (!info.bound.empty()) line << " " << info.bound;
        line << " nodes " << info.nodes << " nps " << info.nps << " time " << info.timeMs << " pv " << info.pv;
        latest[index] = line.str();
        const auto now = std::chrono::steady_clock::now();
        if (now - last[index] >= std::chrono::milliseconds(100)) {
            last[index] = now; emit(latest[index]);
        }
    });
    engine->set_on_bestmove([&](std::string_view move, std::string_view) {
        // Flush every slot before bestmove so the UI keeps the last complete PVs.
        for (const auto& line : latest) if (!line.empty()) emit(line);
        emit("bestmove " + std::string(move));
    });
    // Callbacks must be installed BEFORE resizing: workers copy their context.
    auto& options = engine->get_options();
    options["EvalFile"] = network;
    options["Threads"] = std::to_string(config.threads);
    options["Hash"] = std::to_string(config.hash);
    options["MultiPV"] = std::to_string(XQ_VARIATION_COUNT);
    std::vector<std::string> path;
    std::istringstream input(moves);
    for (std::string move; input >> move;) path.push_back(move);
    engine->set_position(fen, path);
    Stockfish::Search::LimitsType limits;
    limits.depth = config.depth;
    limits.movetime = config.milliseconds;
    limits.startTime = Stockfish::now();
    {
        std::lock_guard<std::mutex> lock(gate);
        if (generation.load() != ticket) return;
        active.store(true); engine->go(limits);
    }
    // Only the control worker waits; never the main/UI thread. Locals captured
    // by callbacks remain alive until every search worker is finished.
    engine->wait_for_search_finished();
    active.store(false);
}
