import vi from './locales/vi.js';
import en from './locales/en.js';

export const languages = Object.freeze({ vi, en });
export function getText(language = 'vi') { return languages[language] || vi; }
const names = {
    vi: { rook: 'xe', horse: 'mã', elephant: 'tượng', advisor: 'sĩ', king: 'tướng', cannon: 'pháo', pawn: 'tốt' },
    en: { rook: 'rook', horse: 'horse', elephant: 'elephant', advisor: 'advisor', king: 'general', cannon: 'cannon', pawn: 'pawn' },
};
const types = { '車': 'rook', '馬': 'horse', '马': 'horse', '相': 'elephant', '象': 'elephant',
    '仕': 'advisor', '士': 'advisor', '帥': 'king', '將': 'king', '炮': 'cannon', '砲': 'cannon', '兵': 'pawn', '卒': 'pawn' };
export function pieceName(name, language = 'vi') { return (names[language] || names.vi)[types[name]] || name; }
