// Engine rows stay compact; bundled book lines may contain a complete game.
// Match the converter's safety bound; recovered book lines can exceed 256 plies.
export const ENGINE_LINE_LIMIT = 12;
export const ENGINE_VARIATION_COUNT = 5;
export const PREVIEW_LINE_LIMIT = 1024;
