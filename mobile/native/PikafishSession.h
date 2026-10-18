#pragma once
#include <atomic>
#include <array>
#include <chrono>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include "engine.h"
#include "EngineOptionsCache.h"

#ifndef XQ_VARIATION_COUNT
#define XQ_VARIATION_COUNT 5
#endif

// One session, one serial caller. cancel() alone may run concurrently.
class PikafishSession {
public:
    using Output = std::function<void(const std::string&, const std::string&)>;
    struct Config { int threads, hash, depth, milliseconds; };
    explicit PikafishSession(Output output);
    ~PikafishSession();
    void analyze(const std::string& id, const std::string& fen, const std::string& moves,
                 const std::string& network, Config config);
    void cancel();
    void release();
    bool searching() const { return active.load(); }
    unsigned configurationChanges() const { return changes.load(); }
    int effectiveThreads() const { return appliedThreads.load(); }
private:
    Output output;
    std::unique_ptr<Stockfish::Engine> engine;
    std::atomic<unsigned long> generation{0};
    std::atomic<bool> active{false};
    std::mutex gate;
    EngineOptionsCache configuration;
    std::atomic<unsigned> changes{0};
    std::atomic<int> appliedThreads{0};
    std::string requestId;
    unsigned long requestTicket = 0;
    std::array<std::string, XQ_VARIATION_COUNT> latest{};
    std::array<std::chrono::steady_clock::time_point, XQ_VARIATION_COUNT> last{};
    void emit(const std::string& line) { if (generation.load() == requestTicket) output(requestId, line); }
};
