# Offline Xiangqi Symbols

`xiangqi-kai.ttf` is a small glyph subset of LXGW WenKai TC Regular, using a
softer handwritten Kai style rather than the previous Noto Serif style.
Source: https://github.com/lxgw/LxgwWenkaiTC/tree/main/fonts/TTF
License: SIL Open Font License 1.1, included in `WenKai-OFL.txt` and retained font metadata.
This is only the Chinese piece/river alphabet, not a general UI or Vietnamese font.
Both supported simplified aliases (horse/chariot) and traditional names are included.
The UI retains its existing Vietnamese/English font stack.

The font is bundled locally by desktop, web and Android, so glyph appearance is
independent of installed CJK fonts. The mobile build copies the license as well.
No network request is needed at runtime. Styles: `styles/chess-theme.css`.

To regenerate with FontTools from `LXGWWenKaiTC-Regular.ttf`:

```powershell
python -m fontTools.subset LXGWWenKaiTC-Regular.ttf --output-file=assets/fonts/xiangqi-kai.ttf --unicodes=U+5E25,U+5C07,U+4ED5,U+58EB,U+76F8,U+8C61,U+99AC,U+9A6C,U+8F66,U+50CC,U+8ECA,U+4FE5,U+7832,U+70AE,U+5175,U+5352,U+695A,U+6CB3,U+6F22,U+754C,U+0020,U+3000 --name-IDs=* --name-legacy --name-languages=* --layout-features= --no-hinting
```
