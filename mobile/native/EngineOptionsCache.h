#pragma once
#include <string>

// Only changed resource options may reach Pikafish: even assigning the same
// Threads/Hash value reallocates and clears its transposition table.
class EngineOptionsCache {
public:
    template<class SetOption>
    bool apply(SetOption set, const std::string& network, int threads, int hash, int pv) {
        bool changed = false;
        if (network != network_) { set("EvalFile", network); network_ = network; changed = true; }
        if (threads != threads_) { set("Threads", std::to_string(threads)); threads_ = threads; changed = true; }
        if (hash != hash_) { set("Hash", std::to_string(hash)); hash_ = hash; changed = true; }
        if (pv != pv_) { set("MultiPV", std::to_string(pv)); pv_ = pv; changed = true; }
        return changed;
    }
    void reset() { network_.clear(); threads_ = hash_ = pv_ = 0; }
private:
    std::string network_;
    int threads_ = 0, hash_ = 0, pv_ = 0;
};
