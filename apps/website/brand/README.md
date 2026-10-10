# Website external brand artwork

This directory owns third-party artwork used by the website. The existing
`sync:brand` command copies shared Vellira artwork and this app-owned source to
`public/brand`. Ownership collisions fail before the generated destination is
replaced. Never edit generated public copies.

| Source                                               | Website URL                       | Consumer                      |
| ---------------------------------------------------- | --------------------------------- | ----------------------------- |
| auth/google-light.svg, google-dark.svg               | /brand/auth/…                     | Authentication                |
| auth/apple-black.svg, apple-white.svg                | /brand/auth/…                     | Authentication                |
| auth/github.svg                                      | /brand/auth/github.svg            | Authentication and navigation |
| social/facebook.svg, linkedin.svg, reddit.svg, x.svg | /brand/social/…                   | Article sharing               |
| integrations/storybook.svg                           | /brand/integrations/storybook.svg | Navigation                    |

Google and Apple files are operator-supplied official complete web artwork;
see auth/README.md. Preserve every byte, including embedded clear space and
foreignObject. They are static browser images, never generic icon-generator
inputs. Light uses google-light/apple-black; dark uses google-dark/apple-white.
Do not add a second visible button boundary or apply color filters.

GitHub and social assets were migrated byte-for-byte from the existing Brand SVG
sources in @vellira-ui/icons. Those released exports remain compatibility
snapshots; do not maintain divergent artwork. Website consumers use these local
files as monochrome masks to preserve their existing theme color and geometry.
Storybook was moved byte-for-byte from shared brand/navigation/storybook.svg.
No new third-party library or runtime asset fetch is involved.

Shared Vellira-owned marks stay in @vellira-ui/assets. DocsVellira is an owned
product mark with a retained public compatibility export, not third-party art.
External trademarks remain owned by their respective owners; repository package
licensing does not grant trademark rights.
