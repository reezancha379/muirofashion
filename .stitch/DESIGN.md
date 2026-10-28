---
name: MUIRO Editorial
colors:
  paper: '#F7F5F2'
  white: '#FFFFFF'
  ink: '#171416'
  muted: '#6B6569'
  line: '#E5E0DC'
  soft: '#F0EDEA'
  crimson: '#9B1B36'
  plum: '#291B31'
  warning-background: '#FFFBEB'
  warning-foreground: '#78350F'
typography:
  display:
    fontFamily: 'Georgia, Times New Roman, serif'
    fontSize: 30px
    fontWeight: '400'
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  headline:
    fontFamily: 'Georgia, Times New Roman, serif'
    fontSize: 30px
    fontWeight: '400'
    lineHeight: 1.15
    letterSpacing: '-0.01em'
  body:
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 1.5
    letterSpacing: '0'
  label:
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 1.35
    letterSpacing: '0.08em'
rounded:
  sm: 8px
  DEFAULT: 12px
  md: 16px
  lg: 24px
  full: 9999px
spacing:
  unit: 8px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  section: 64px
  gutter-mobile: 16px
  gutter-desktop: 32px
---

# Design System: MUIRO Editorial

## 1. Visual Theme & Atmosphere

MUIRO is a fashion-editorial storefront with an owner-only content studio. Its visual language is warm, product-first, and modern-classic: editorial photography, a compact centered wordmark, warm paper surfaces, deep ink, and a reserved crimson action color do the expressive work. Plum is a secondary accent, most useful for owner-facing surfaces and hover states.

The storefront favors clear shopping paths and quiet utility. Preserve the existing catalogue, imagery, affiliate disclosures, routes, and wordmark. The hero uses a localized dark image overlay to keep white text legible; avoid expanding that treatment into decorative gradients or glass effects elsewhere. Keep motion subordinate and respect reduced-motion preferences.

## 2. Color Palette & Roles

### Primary Foundation

- **Paper — `#F7F5F2`**: warm page canvas and light text on dark surfaces.
- **White — `#FFFFFF`**: product, form, and secondary-action surfaces.
- **Ink — `#171416`**: primary text, navigation, and grounding surfaces.
- **Muted — `#6B6569`**: secondary copy and metadata.
- **Line — `#E5E0DC`** and **Soft — `#F0EDEA`**: restrained borders and quiet backgrounds. Several legacy component classes use close warm-neutral aliases; keep new work on these tokens.

### Accent & Interactive

- **MUIRO Crimson — `#9B1B36`**: primary shopping/conversion action, links, and visible keyboard focus. Use it deliberately, not as a decorative wash.
- **Plum — `#291B31`**: secondary accent and owner/admin distinction; suitable for hover/active states when a darker follow-up state is needed.
- On Paper, Ink has approximately 16.8:1 contrast, Crimson 7.4:1, and Plum 14.9:1. Do not use pale crimson for small text without checking contrast.

### Typography & Text Hierarchy

Use Ink for reading text and Muted for supporting metadata. The system is predominantly sans-serif for navigation, body, buttons, and product facts, with a restrained Georgia serif for editorial headlines and selected lookbook titles.

### Functional States

- **Warning / pending publication**: existing pale amber with dark amber text. Include explanatory text; color is not the only signal.
- **Error / validation**: pair clear text with the relevant field or action.
- **Dark mode** is not enabled; the app declares a light color scheme only. Do not imply a tested dark palette.

## 3. Typography Rules

### Hierarchy & Weights

- **Body and utility face:** `Plus Jakarta Sans`, locally self-hosted in `public/fonts/`; used by the page body and the current `font-casual` / `font-display` utility aliases.
- **Editorial face:** `Georgia, 'Times New Roman', serif`, used by `font-serif-editorial`. The hero and the main look-edit heading now use this face at a calm regular weight.
- `public/fonts/fonts.css` also declares a local `Urbanist` face, but the active global token does not currently assign it. The checked-in frontend does not load Libre Caslon Text or DM Sans; do not claim those are shipped fonts unless the assets and declarations are added.
- Current scale is responsive rather than a single fixed ramp: hero titles are 20/24/30px across breakpoints; main section headings are 30/36px; body copy commonly ranges 12–16px; uppercase utility labels are about 10–12px with tracking.

### Spacing Principles

Use Tailwind's 4px baseline with a common 8px rhythm. Familiar steps are 8, 16, 24, 32, and 48px; major sections reach about 64px on wider screens. Keep product facts compact and give major imagery room to breathe.

## 4. Component Stylings

### Buttons

Primary affiliate and hero conversion actions use Crimson with white text and a clear shopping verb; Plum is a restrained hover state. Secondary actions use a white/Paper surface with an Ink border and text. Preserve existing pill and rounded-rectangle variants, stable hit areas, short transitions, and a visible Crimson focus outline with offset.

### Cards & Containers

Product cards are image-led with a 3:4 image, compact facts, a fine warm border, and a retailer action. Lookbook cards use editorial imagery and serif titles. Existing radii range from 12px cards to 24px hero frames and full pills; follow the component being extended rather than imposing a new universal radius. Use shadows sparingly and preserve image crop/focal behavior.

### Navigation

The desktop header uses a left-aligned route list, centered wordmark, and right-side search/filter/wishlist controls. Mobile collapses the route list behind a menu icon while keeping the wordmark and key tools visible. Preserve the current labels and owner-entry behavior; authorization remains server-side.

### Inputs & Forms

Use visible labels, concise helper/error copy, high-contrast Ink text, and a clear Crimson focus ring. Preserve field order and names where they are part of authentication or the CMS. Announce errors and never rely on color alone.

### Domain-Specific Components

- **Hero carousel:** fixed 4:3 frame, whole foreground image over a blurred fill, localized dark contrast overlay, concise title/tagline, crimson shop action, and direct secondary navigation. Carousel controls have 44px minimum mobile hit areas; autoplay stops for reduced-motion users and while keyboard focus is inside the carousel.
- **Product card:** image → concise product facts → direct retailer action. Affiliate navigation must remain immediate; telemetry is best-effort and must not block the shopper.
- **Owner analytics:** use honest measurement windows; do not imply growth or comparisons without a baseline.
- **Publication notice:** accessible status for the authenticated owner only when a CMS save succeeded but public refresh is pending; it must not block editing.

## 5. Layout Principles

### Grid & Structure

The storefront uses a centered frame, commonly `max-w-7xl`, with responsive product/lookbook grids. The hero leads into the look-edit and catalogue. Preserve current routes, query-driven views, filters, sorting, pagination, wishlist, image inspection, and owner studio flows.

### Whitespace Strategy

Use about 16px mobile edge gutters and 24–32px desktop gutters. Existing section spacing commonly moves from 48px on mobile to 64px at larger breakpoints. Keep image-to-action sequences intact while reducing incidental gaps on small screens.

### Alignment & Visual Balance

Keep the portrait-friendly imagery prominent, text consistently aligned within cards, and the retailer action visually distinct but subordinate to the product image and title. Use existing CMS imagery rather than generic stock.

### Responsive Behavior & Touch

The project uses Tailwind breakpoints at 640, 768, 1024, and 1280px. Build mobile-first, let grids collapse progressively, preserve readable disclosures, and keep key shopping actions reachable without hover. Avoid horizontal overflow and target at least 44px for touch controls where practical.

## 6. Design System Notes for Stitch Generation

### Language to Use

“Quiet fashion editorial,” “warm paper and deep ink,” “product-first portrait imagery,” “Georgia editorial headlines,” “Plus Jakarta Sans utility copy,” “crimson reserved for meaningful actions,” and “fine warm-neutral borders.” Avoid invented products/claims, generic gradients outside the image-legibility overlay, and glassmorphism.

### Color References

Use Paper `#F7F5F2`, Ink `#171416`, Crimson `#9B1B36`, and Plum `#291B31` as identity anchors. Muted, Line, and Soft are supporting neutrals; amber is reserved for the existing warning state.

### Component Prompts

1. “Design a mobile-first MUIRO fashion lookbook landing screen. Keep the supplied portrait editorial image and centered wordmark, use a warm Paper canvas, a Georgia headline, Plus Jakarta Sans utility copy, and Crimson only for the primary shop action. Do not invent products or claims.”
2. “Create a MUIRO product card that preserves the supplied image and crop, shows concise product facts and retailer disclosure, and offers a high-contrast Crimson retailer button with a quiet warm border.”
3. “Create an owner analytics panel with MUIRO Ink/Paper/Plum tokens, clear labels, and honest measurement windows. Keep it visually aligned with the public brand and do not show unmeasured growth claims.”

### Incremental Iteration

Preserve catalogue IDs, image URLs, affiliate destinations, disclosures, navigation labels, and visitor/owner contracts. Iterate on typography, spacing, focus visibility, and state feedback first. Keep motion understated, stop autoplay under reduced-motion preferences, and use the existing local font assets.
