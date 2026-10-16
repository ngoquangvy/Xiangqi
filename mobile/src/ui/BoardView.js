import { displaySquare, boardSquare } from './coordinates.js';
import { pieceName, getText } from './strings.js';

const SVG = 'http://www.w3.org/2000/svg';
function path(d) {
    const node = document.createElementNS(SVG, 'path');
    node.setAttribute('d', d);
    return node;
}

export class BoardView {
    constructor(element, onTap) {
        this.element = element;
        this.cells = [];
        const grid = element.querySelector('svg');
        grid.append(path('M18 18H432V482H18Z'));
        for (let y = 0; y < 10; y++) grid.append(path(`M25 ${25 + y * 50}H425`));
        for (let x = 0; x < 9; x++) {
            const xx = 25 + x * 50;
            grid.append(path(x === 0 || x === 8 ? `M${xx} 25V475` : `M${xx} 25V225M${xx} 275V475`));
        }
        grid.append(path('M175 25L275 125M275 25L175 125M175 375L275 475M275 375L175 475'));
        for (const [x, label] of [[125, '\u695a \u6cb3'], [325, '\u6f22 \u754c']]) {
            const river = document.createElementNS(SVG, 'text');
            river.setAttribute('x', String(x)); river.setAttribute('y', '258');
            river.textContent = label;
            grid.append(river);
        }
        // Traditional cannon/pawn registration marks are decorative, not hit targets.
        for (const [x, y] of [[1, 2], [7, 2], [1, 7], [7, 7], ...[0, 2, 4, 6, 8].flatMap(x => [[x, 3], [x, 6]])]) {
            for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
                if ((x === 0 && dx < 0) || (x === 8 && dx > 0)) continue;
                const xx = 25 + x * 50 + dx * 5, yy = 25 + y * 50 + dy * 5;
                grid.append(path(`M${xx + dx * 6} ${yy}H${xx}V${yy + dy * 6}`));
            }
        }
        const squares = element.querySelector('.squares');
        for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) {
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'square';
            button.style.left = `${x * 100 / 9}%`; button.style.top = `${y * 10}%`;
            const chip = document.createElement('span'); chip.className = 'chip chess-piece';
            button.append(chip);
            button.onclick = () => {
                const point = boardSquare(x, y, this.flipped);
                onTap(point.x, point.y);
            };
            squares.append(button);
            this.cells.push({ button, chip, x, y });
        }
    }
    render(state) {
        const text = getText(state.ui.language);
        this.flipped = state.ui.flipped;
        this.element.setAttribute('aria-label', state.ui.preview ? text.cancelPreview : state.boardLocked ? text.miniBoard : text.boardLarge);
        for (const { button, chip, x, y } of this.cells) {
            const square = displaySquare(x, y, this.flipped);
            const piece = state.board[square.y][square.x];
            const selected = square.x === state.ui.selected?.x && square.y === state.ui.selected?.y;
            const legal = state.legalMoves.some(move => move.x === square.x && move.y === square.y);
            const last = state.lastMove;
            const lastSquare = last && ((square.x === last.fromX && square.y === last.fromY)
                || (square.x === last.toX && square.y === last.toY));
            const suggested = state.suggestionMove;
            const suggestionSquare = suggested && ((square.x === suggested.fromX && square.y === suggested.fromY)
                || (square.x === suggested.toX && square.y === suggested.toY));
            const checked = square.x === state.checkedKing?.x && square.y === state.checkedKing?.y;
            button.className = ['square', piece?.color || '', selected ? 'selected' : '',
                legal ? 'legal' : '', lastSquare ? 'last' : '', suggestionSquare ? 'suggestion' : '', checked ? 'checked' : ''].filter(Boolean).join(' ');
            // Preview squares are exit targets, not move targets. AppStore
            // consumes that first touch before any selection/move processing.
            button.disabled = state.boardLocked && !state.ui.preview;
            button.setAttribute('aria-pressed', String(selected));
            const name = piece ? `${pieceName(piece.name, state.ui.language)} ${text[piece.color]}` : text.emptySquare;
            const coordinate = String.fromCharCode(97 + square.x) + (9 - square.y);
            button.setAttribute('aria-label', `${state.ui.preview ? text.cancelPreview + ': ' : ''}${name}, ${coordinate}${legal ? ', ' + text.legalSquare : ''}${checked ? ', ' + text.check : ''}`);
            button.dataset.square = coordinate;
            chip.textContent = piece?.name || '';
        }
    }
}
