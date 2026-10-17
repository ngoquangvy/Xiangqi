// Preserve complete engine PVs: the pinned Pikafish MAX_PLY is 246. This input
// safety bound is above that ceiling, not a UI limit on search or replay length.
export const ENGINE_LINE_LIMIT = 256;
export const ENGINE_VARIATION_COUNT = 5;
// Match the converter's safety bound; book lines can contain a complete game.
export const PREVIEW_LINE_LIMIT = 1024;
