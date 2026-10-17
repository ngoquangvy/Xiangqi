import profiles from '../../engine/profiles.json' with { type: 'json' };
// UI and both native platforms share this allowlist. Zero depth AND time means
// continuous search, not zero work; memory and thread budgets remain bounded.
export const PROFILES = Object.freeze(Object.fromEntries(Object.entries(profiles).map(([name, value]) => [name, Object.freeze(value)])));
export function analysisSettings(value) {
    return { profile: Object.hasOwn(PROFILES, value?.profile) ? value.profile : 'balanced', bookEnabled: value?.bookEnabled !== false };
}
export function bookKey(fen) {
    // Counters are not part of a book position. Side to move is essential.
    const parts = typeof fen === 'string' ? fen.trim().split(/\s+/) : [];
    return parts.length === 6 && ['w', 'b'].includes(parts[1]) ? parts.slice(0, 2).join(' ') : null;
}
