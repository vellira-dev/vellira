# Official web authentication artwork

These operator-supplied provider assets are complete web button/logo-mode
artwork, not cross-platform glyphs. Preserve their bytes, viewBox, colors and
embedded clear space. Do not run them through SVGR, SVGO, formatting or the
web/native icon generator. In particular Google's official artwork contains
`foreignObject` HTML. The browser consumes these files as static local images.

| Source supplied by operator | File             | Surface |
| --------------------------- | ---------------- | ------- |
| GoogleLight.svg             | google-light.svg | Light   |
| GoogleDark.svg              | google-dark.svg  | Dark    |
| AppleBlack.svg              | apple-black.svg  | Light   |
| AppleWhite.svg              | apple-white.svg  | Dark    |

`@vellira-ui/assets sync-brand` copies this directory without transformation to
`apps/website/public/brand/auth/`. The original provider trademarks/artwork remain
subject to their respective owners' terms; the package's software license does
not grant trademark rights. GitHub is the byte-identical migration of the existing GitHub glyph. Website navigation and auth share this one source; the public icon export remains a frozen compatibility surface, not the website artwork authority.

Do not draw a second visible button boundary around this complete artwork. Add
accessible interaction and external focus affordances with canonical Vellira
controls. Theme selection chooses the supplied asset, never a CSS inversion.
