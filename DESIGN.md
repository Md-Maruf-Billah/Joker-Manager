# Joker Manager Design Context

The UI follows PlayLive Melbourne's brand guidelines and Apple's design philosophy: light,
restrained, content-first, generous whitespace, and system typography.

## Brand

- Primary red `#EC1E24` (buttons, active nav, key emphasis).
- Secondary accents: burgundy `#7C0917`, green `#034C2A`, teal `#144B64`, gold `#C69D42`.
- Typeface: Montserrat, falling back to `-apple-system`/`BlinkMacSystemFont`.
- Logo marks live in `public/brand/`: `playlive-icon.png` (outlined mark, light backgrounds)
  and `playlive-logo.png` (white mark, dark backgrounds like the TV display).

## Staff UI

The staff UI is a light, Apple-style control panel:

- System-gray background (`#F5F5F7`), white cards, hairline borders (`rgba(0,0,0,0.07)`).
- Sidebar navigation with translucent backdrop blur, red active state.
- Brand red primary actions; teal for admin-only actions; red-tinted danger actions.
- No decorative motion during data entry — only functional feedback (loading, success, error).
- No illustrative example values in form placeholders (names, PINs, amounts). Use hint text
  under the field instead when guidance is needed.

## TV Display

The TV display stays dark and premium, tier-themed by cards remaining:

- Jackpot amount is the largest element; cards remaining is second priority.
- Probability appears only at 20 cards or fewer; latest Joker winner appears only from 53 to
  48 cards remaining (i.e. right after a fresh deck starts).
- Tier accent/glow colors (`src/pages/TvDisplayPage.tsx`, `TIER_THEME`): fresh `#D9B15B`,
  building `#49B57C`, hot `#EC1E24`, probability `#E8C245`, danger `#FF4141`.
- A staff-pushed TV announcement (Admin → TV announcement panel) takes over the whole screen
  with a gold `#C69D42` theme until cleared. It does not require a special "celebration" state
  or extra backend tracking — it reuses the same `TvDisplayData` shape as the normal tiers.
- Motion is slow and legible: light-bulb marquee chase around the panel border, a live-pulse
  dot on the bottom ticker, and a soft fade/rise when the tier or jackpot value changes.

## Charts

Dashboard's jackpot trend chart follows the same restraint: no gridlines, a single smooth
gold stroke and soft area fill, one marker on the latest point. Data speaks for itself instead
of being boxed in.
