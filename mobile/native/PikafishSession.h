#pragma once
#include <atomic>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include "engine.h"

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
private:
    Output output;
    std::unique_ptr<Stockfish::Engine> engine;
    std::atomic<unsigned long> generation{0};
    std::atomic<bool> active{false};
    std::mutex gate;
};
