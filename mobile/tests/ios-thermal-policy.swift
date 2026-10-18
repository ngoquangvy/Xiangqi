import Foundation
@main struct ThermalPolicyTest {
    static func main() {
        var policy = ThermalPolicy()
        policy.update("fair", now: 0)
        assert(policy.limited && !policy.blocked)
        policy.update("nominal", now: 1)
        assert(policy.limited && !policy.blocked)
        policy.update("nominal", now: 10)
        assert(policy.limited)
        policy.update("nominal", now: 11)
        assert(!policy.limited)
        policy.update("serious", now: 12)
        assert(policy.blocked && policy.limited)
        policy.update("fair", now: 13)
        assert(policy.blocked) // Fair is not enough to resume after high heat.
        policy.update("nominal", now: 14)
        policy.update("critical", now: 20)
        policy.update("nominal", now: 21)
        policy.update("nominal", now: 30.9)
        assert(policy.blocked)
        policy.update("nominal", now: 31)
        assert(!policy.blocked && !policy.limited)
        assert(policy.revision > 0)
        print("THERMAL_POLICY_PASS")
    }
}
