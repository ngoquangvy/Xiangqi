export function displaySquare(x, y, flipped) {
    return flipped ? { x: 8 - x, y: 9 - y } : { x, y };
}
export function boardSquare(x, y, flipped) { return displaySquare(x, y, flipped); }
