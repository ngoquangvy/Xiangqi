// src/shared/ipcChannels.js
// Central registry of all IPC channel names.
// Used by both preload.js (renderer side) and IPCRouter.js (main side).
// Keep all names in kebab-case. Do not define channels inline.

const IPC = {
    // --- GAME STATE ---
    GET_GAME_STATE:         'get-game-state',
    IMPORT_FEN:             'import-fen',
    GET_LEGAL_MOVES:        'get-legal-moves',
    IS_KING_IN_CHECK:       'is-king-in-check',
    IS_CHECKMATE:           'is-checkmate',
    MOVE_PIECE:             'move-piece',
    UNDO:                   'undo',
    REDO:                   'redo',
    RESET_TO_INITIAL:       'reset-to-initial',
    RESET_GAME:             'reset-game',
    GO_TO_MOVE:             'go-to-move',
    GET_MOVE_NOTATION:      'get-move-notation',
    EXPORT_GAME:            'export-game',
    EXPORT_PGN:             'export-pgn',
    IMPORT_GAME:            'import-game',
    UPDATE_MOVE_NOTE:       'update-move-note',
    UPDATE_MOVE_VARIATION:  'update-move-variation',
    SET_FLIPPED:            'set-flipped',

    // --- ENGINE ---
    ANALYZE_POSITION:       'analyze-position',
    EVALUATE_MOVE:          'evaluate-move',
    STOP_ENGINE:            'stop-engine',
    FORMAT_PV:              'format-pv',
    TRANSLATE_PV_GROUPS:    'translate-pv-groups',
    SIMULATE_PV:            'simulate-pv',
    GET_ENGINES:            'get-engines',
    GET_SELECTED_ENGINE_INDEX: 'get-selected-engine-index',
    ADD_ENGINE:             'add-engine',
    REMOVE_ENGINE:          'remove-engine',
    SELECT_ENGINE:          'select-engine',
    UPDATE_ENGINE_CONFIG:   'update-engine-config',

    // --- ENGINE EVENTS (Main -> Renderer) ---
    ENGINE_OUTPUT:          'engine-output',
    EVAL_ENGINE_OUTPUT:     'eval-engine-output',
    EVAL_ENGINE_STATUS:     'eval-engine-status',
    STOP_EVAL_ENGINE:       'stop-eval-engine',
    ENGINE_STATUS:          'engine-status',
    ENGINE_READY:           'engine-ready',
    ENGINE_ERROR:           'engine-error',
    ENGINE_PONDER:          'engine-ponder',
    UPDATE_PROTOCOL:        'update-protocol',

    // --- BOOK ---
    GET_BOOK_CANDIDATES:    'get-book-candidates',
    GET_CURRENT_BOOK_PATH:  'get-current-book-path',
    GET_BOOKS:              'get-books',
    SELECT_BOOK:            'select-book',
    IMPORT_BOOK_FILE:       'import-book-file',
    UPDATE_BOOK_NOTE:       'update-book-note',
    CONVERT_BOOK_LANGUAGE:  'convert-book-language',

    // --- APP / UTILITY ---
    EXIT_APP:               'exit-app',
    BROWSE_FILE:            'browse-file',
    BROWSE_ENGINE_BOOK:     'browse-engine-book',
};

module.exports = IPC;
