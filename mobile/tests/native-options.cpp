#include "../native/EngineOptionsCache.h"
#include <cassert>
#include <utility>
#include <vector>

int main() {
    EngineOptionsCache cache;
    std::vector<std::pair<std::string, std::string>> calls;
    const auto set = [&](std::string name, std::string value) { calls.emplace_back(name, value); };
    assert(cache.apply(set, "offline.nnue", 2, 64, 5));
    assert(calls.size() == 4);
    calls.clear();
    assert(!cache.apply(set, "offline.nnue", 2, 64, 5));
    assert(calls.empty()); // New position, depth or time must not clear the hash.
    assert(cache.apply(set, "offline.nnue", 1, 64, 5));
    assert(calls.size() == 1 && calls[0].first == "Threads");
    calls.clear();
    assert(cache.apply(set, "offline.nnue", 1, 32, 5));
    assert(calls.size() == 1 && calls[0].first == "Hash");
    calls.clear(); cache.reset();
    assert(cache.apply(set, "offline.nnue", 1, 32, 5));
    assert(calls.size() == 4); // New native engine must be fully configured again.
}
