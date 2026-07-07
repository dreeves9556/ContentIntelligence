# The Local Post — Branding Guide

> **Your town. Your post.**

---

## 1. Brand Story

### The Name

**The Local Post** — three words that carry a heritage, a mission, and a product.

Every town used to have one trusted source of local information: the local newspaper. *The Post.* It was the authority. If it was in *The Post*, it mattered, and the people writing it were the most trusted voices in town.

That institution has faded, but the need for it never did. People still want a trusted local voice. Today, that role is filled by individuals on social media, and the currency is the post itself.

The name works on two levels:

1. **The Local Post** is the modern local newspaper — a platform that gives everyday people the tools to become the trusted voice in their market.
2. A **"post"** is literally what the app helps users create every day.

The mission: teach real estate agents and local business owners to become the local expert and the local authority in their market through content. The name wraps that mission, the heritage, and the product into three words.

### The Feeling

When someone opens the app, it should feel like: **this is my town's front page, and I'm the publisher.**

It should never feel vintage or dusty. The newspaper is the soul, but the body is a modern, light, premium app.

### Structural Note

The Local Post is a **product**, not the parent brand. It lives inside a membership community (separate name, Facebook group, and identity) as the flagship tool. The Local Post is designed to stand completely on its own — its logo, palette, and identity do not depend on anything else, because it may operate as a standalone product in the future.

Billing and business operations run through **Core Coaching & Investments**, but that stays behind the scenes and never appears in the app branding.

---

## 2. Taglines

Use these in mockups, onboarding screens, marketing surfaces, and rotating displays:

| # | Tagline | Use Case |
|---|---------|----------|
| 1 | **Your town. Your post.** | Primary tagline, login screen, hero copy |
| 2 | **Be the local authority.** | Onboarding, feature highlights, CTA sections |
| 3 | **The front page of your market.** | Marketing pages, meta description, email headers |
| 4 | **Every town needs a trusted voice. Become it.** | Long-form copy, mission statements, about pages |

### Implementation

Taglines are already implemented as a rotating display on the login screen via the `RotatingTagline` component (`src/components/RotatingTagline.tsx`). They cycle every 4 seconds with a fade-in animation, rendered in Playfair Display italic.

---

## 3. Color System

### Design Philosophy

Light, clean, and confident. Not a dark app. It should feel like an app you want to open every morning.

The palette reinforces the newspaper story: **black ink on white paper with one bold accent.** That restraint is what keeps it feeling premium and light.

### Usage Rule: 60 / 30 / 10

- **60%** — White and off-white (backgrounds, cards, sections)
- **30%** — Ink text (headlines, body copy, navigation)
- **10%** — Royal blue (buttons, links, active states, progress indicators only)

The blue is never used as a background fill for large areas. It is reserved for interaction points and accents — that restraint is the brand.

### Light Theme (Default)

| Token | Hex | Role |
|-------|-----|------|
| `--color-background-primary` | `#FFFFFF` | Page background, app canvas |
| `--color-background-secondary` | `#F7F9FC` | Cards, sections, sidebar, input fields — soft off-white for depth without heaviness |
| `--color-background-card` | `#FFFFFF` | Card surfaces (elevated above secondary) |
| `--color-text-primary` | `#101418` | Ink black — primary text, headlines, body |
| `--color-text-muted` | `#5B6472` | Secondary text, labels, metadata, placeholder text |
| `--color-accent-primary` | `#1E56D6` | Royal blue — buttons, links, active nav states, focus rings, progress |
| `--color-border-primary` | `#CBD5E1` | Primary borders — card edges, dividers |
| `--color-border-secondary` | `#94A3B8` | Secondary borders — input focus, emphasis dividers |

### Night Edition (Dark Mode)

The dark theme is labeled **"Night Edition"** — an editorial nod to the afternoon/evening paper. It is a premium editorial dark: deep charcoal, soft gray, and a brighter blue for legibility against the dark canvas.

| Token | Hex | Role |
|-------|-----|------|
| `--color-background-primary` | `#101418` | Deep charcoal — page background |
| `--color-background-secondary` | `#1A1F26` | Elevated sections, sidebar |
| `--color-background-card` | `#222831` | Card surfaces |
| `--color-text-primary` | `#F7F9FC` | Off-white — primary text |
| `--color-text-muted` | `#8B95A5` | Muted gray — secondary text |
| `--color-accent-primary` | `#2E5BFF` | Brighter royal blue — maintains contrast on dark canvas |
| `--color-border-primary` | `#2A313C` | Subtle dark borders |
| `--color-border-secondary` | `#3A4250` | Emphasis borders |

### Accent Alternative

If `#1E56D6` feels too deep in specific UI contexts, `#2E5BFF` is the sanctioned brighter alternative. **Pick one per context, not both.** The light theme uses `#1E56D6` as the primary accent; the dark theme uses `#2E5BFF`. Do not mix them within the same theme.

### Content Pill Colors (Semantic)

Three sub-brand colors are used to categorize content pillars (Personal, Expert, Local). These are not part of the 60/30/10 rule — they appear only as small tags, dots, and labels.

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--color-brand-personal` | `#C23E54` | `#E85670` | Personal story / behind-the-scenes content |
| `--color-brand-expert` | `#B97300` | `#F5A623` | Educational / authority content |
| `--color-brand-local` | `#0E7C7B` | `#14B8C6` | Local market / community content |

### Admin Panel (Behind the Scenes)

The admin panel uses a separate dark palette that does not follow the brand system. It is intentionally distinct so admins know they are in a back-office context:

- Background: `#0a0a0a` / `#111111`
- Text: `#e8e8e8` / `#787878`
- Accent: `#c8952a` (antique gold)
- Icon: `Crown` (lucide-react)

**This is not part of the user-facing brand.** It should never appear in user-facing screens or marketing materials.

---

## 4. Typography

### Font System

Two typefaces. One serif for editorial weight, one sans-serif for modern clarity.

| Role | Font | CSS Variable | Usage |
|------|------|-------------|-------|
| **Serif / Display** | Playfair Display | `--font-playfair` | Wordmark, all headings (h1–h6), taglines, section titles, card titles — the editorial voice |
| **Sans / Body** | DM Sans | `--font-dm-sans` | All body text, UI labels, buttons, navigation, inputs, metadata — the modern interface voice |

### Loading

Fonts are loaded via `next/font/google` in `src/app/layout.tsx` with `display: "swap"` for optimal loading performance. The CSS variables are mapped in `globals.css` under `@theme`:

```css
--font-sans: var(--font-dm-sans), "DM Sans", sans-serif;
--font-serif: var(--font-playfair), "Playfair Display", serif;
```

### Hierarchy Rules

- **All headings (h1–h6)** automatically use Playfair Display via a global CSS rule in `globals.css`. No per-component font overrides needed for headings.
- **Body and UI** use DM Sans by default (set on `body` in `globals.css`).
- **The wordmark** "The Local Post" is always set in Playfair Display, typically `font-bold` / `text-lg`, with `letter-spacing: tight`.
- **Taglines** are set in Playfair Display *italic* — this is the editorial flourish that signals the newspaper voice.
- **Inline font overrides** use `style={{ fontFamily: "var(--font-serif)" }}` or `style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}` when a specific element needs to break the default.

### Type Scale (Recommended)

| Element | Font | Size | Weight | Notes |
|---------|------|------|--------|-------|
| Wordmark | Playfair Display | `text-lg` (18px) | `font-bold` (700) | In sidebar/header, `tracking-tight` |
| Page title (h1) | Playfair Display | `text-3xl` (30px) | `font-bold` (700) | `tracking-tight` |
| Section title (h2) | Playfair Display | `text-xl` (20px) | `font-semibold` (600) | |
| Card title (h3) | Playfair Display | `text-lg` (18px) | `font-semibold` (600) | |
| Body | DM Sans | `text-sm` (14px) / `text-base` (16px) | `font-normal` (400) | |
| Label / Metadata | DM Sans | `text-xs` (12px) | `font-medium` (500) | `uppercase tracking-wider` for section labels |
| Button | DM Sans | `text-sm` (14px) | `font-medium` (500) | |
| Tagline | Playfair Display | `text-lg` (18px) | `font-normal` (400) | `italic` — the editorial flourish |

---

## 5. Logo & Icon Direction

### Wordmark

The wordmark is **"The Local Post"** set in Playfair Display, bold, with tight letter-spacing. It sits in the sidebar header, mobile header, and login screen alongside a mark icon.

Current implementation uses a `Sparkles` icon (lucide-react) as a placeholder mark. This should be replaced with a custom newspaper-themed mark (see below).

### Mark / App Icon Concepts

The client specified these directions for the icon:

1. **Folded paper** — a simplified newspaper fold, geometric and clean
2. **Rolled newspaper** — a cylinder/scroll form, minimal
3. **Location pin blended with a paper or "P"** — combining the "local" and "post" ideas into one mark

**Constraints:**
- Must work as an app icon at small sizes (16×16 favicon up to 512×512 app icon)
- Must be readable in monochrome (ink on white) and in single-color blue
- Should not feel vintage or literal — it's a modern interpretation of a newspaper cue

### Current Icon (Placeholder)

The current `public/icon.svg` is a placeholder with a dark background (`#0a0a0a`) and gold circles (`#c8952a`) — this is leftover from the old CoreOS/admin branding and **must be replaced** with a The Local Post branded icon using the correct palette (`#FFFFFF` background, `#1E56D6` or `#101418` mark).

### Masthead Treatment

The client requested a **masthead-style logo treatment** — the way a newspaper name sits across the top of the front page. Implementation directions:

- On marketing/landing pages: full-width masthead bar with "The Local Post" centered in Playfair Display, large, with thin rules above and below (newspaper masthead convention)
- In the app sidebar: compact wordmark + mark, left-aligned
- On the login screen: centered wordmark + mark, with tagline below in italic serif

---

## 6. Design Language: Newspaper Structure

The client asked for newspaper cues pulled into the design without making it look old or literal. Here's how that translates to UI patterns:

### Editorial UI Patterns

| Newspaper Concept | App Implementation |
|-------------------|-------------------|
| **Masthead** | Top bar / sidebar header with wordmark in serif, thin rule beneath |
| **Front page headline** | Page titles in Playfair Display, large and bold |
| **Section labels** | `uppercase tracking-wider text-xs` labels above sections — like "TODAY'S EDITION" or "ANALYTICS" |
| **Columns and cards** | Card-based layouts with clear borders, structured spacing — like newspaper columns |
| **Datelines** | Date stamps on content cards, calendar entries — "Mon, Jul 6" format, muted text |
| **Bylines** | Author/source attribution on resources and AI-generated content |
| **Pull quotes** | Blockquotes with left accent-blue border (already implemented in Tiptap content styles) |
| **Section dividers** | Thin horizontal rules (`border-border-primary`) between major sections |

### "Today's Edition" Energy

The daily content feed / calendar should feel like opening today's newspaper. Directions:

- Date displayed prominently at the top of the calendar view, in serif
- Content cards structured like article cards: headline (serif), body preview (sans), dateline (muted), platform tag (accent color)
- Empty state: "No posts scheduled for today. The front page is yours to fill."

### Card Pattern

Cards are the primary structural element. Standard card:

```
┌─────────────────────────────────┐
│  [Section Label - uppercase]    │
│  Headline (Playfair Display)     │
│  Body preview (DM Sans, muted)   │
│  ──────────────────────────────  │
│  [Date]  [Platform tag]  [Status]│
└─────────────────────────────────┘
```

- Background: `bg-background-card` (`#FFFFFF` light / `#222831` dark)
- Border: `border border-border-primary` (`#E2E8F0` light / `#2A313C` dark)
- Border radius: `rounded-lg` (8px) — clean, not overly rounded
- Padding: `p-6` standard, `p-4` compact
- No drop shadows by default — depth comes from the off-white secondary background behind white cards

---

## 7. Component System

### Buttons

Defined in `src/components/ui/button.tsx` using `class-variance-authority` (cva).

| Variant | Style | Usage |
|---------|-------|-------|
| `default` | `bg-accent-primary text-background-primary hover:bg-accent-primary/90` | Primary actions: Sign In, Save, Generate, Connect |
| `outline` | `border border-accent-primary text-accent-primary hover:bg-accent-primary/10` | Secondary actions: Cancel, Back |
| `ghost` | `hover:bg-background-secondary text-text-primary` | Tertiary actions: nav items, icon buttons |
| `secondary` | `bg-background-card text-text-primary hover:bg-background-secondary` | Alternative secondary: card actions |

| Size | Dimensions |
|------|-----------|
| `default` | `h-10 px-4 py-2` |
| `sm` | `h-9 px-3` |
| `lg` | `h-11 px-8` |
| `icon` | `h-10 w-10` |

**Rules:**
- One `default` (blue) button per section — it's the primary action
- Never use blue for large background fills
- `rounded-md` (6px) on all buttons — consistent with the clean, not-too-rounded aesthetic

### Inputs

Standard input pattern (from login page):

```
bg-background-secondary
border border-background-secondary
rounded-md
text-text-primary
placeholder:text-text-muted
focus:ring-2 focus:ring-accent-primary/50
focus:border-accent-primary/50
```

Inputs sit on the off-white secondary background, blending seamlessly until focused — then the blue ring signals interaction.

### Navigation

Sidebar navigation (desktop) and drawer (mobile):

- Active state: `bg-accent-primary/10 text-accent-primary` — subtle blue tint, not a solid fill
- Inactive: `text-text-muted hover:text-text-primary hover:bg-background-card`
- Locked (tier-gated): `text-text-muted/50 cursor-not-allowed` with `Lock` icon
- Icons: `lucide-react`, 20px (`h-5 w-5`)
- Labels: DM Sans, `text-sm font-medium`

### Theme Toggle

Three-way toggle: Light / Night / System, using `next-themes`. Rendered as a compact pill in the sidebar footer.

---

## 8. Spacing & Layout

### Grid

- Sidebar: `w-64` (256px) fixed, desktop only
- Main content: `flex-1` with `p-4 sm:p-6 lg:p-8` responsive padding
- Max content width: `max-w-md` (448px) for auth screens, `max-w-7xl` (1280px) for dashboard content
- Cards: full-width within their grid, `gap-4` or `gap-6` between

### Spacing Scale

Follow Tailwind's default scale. Key values:

| Token | Value | Usage |
|-------|-------|-------|
| `gap-1` | 4px | Tight groupings (icon + label) |
| `gap-2` | 8px | Button internals, small clusters |
| `gap-3` | 12px | Nav item internals |
| `gap-4` | 16px | Card grids, form field spacing |
| `gap-6` | 24px | Section-level spacing |
| `gap-8` | 32px | Major section breaks |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-md` | 6px | Buttons, inputs, small elements |
| `rounded-lg` | 8px | Cards, panels |
| `rounded-2xl` | 16px | Overlay modals, feature highlights |
| `rounded-full` | 9999px | Pills, badges, avatar circles |

---

## 9. Iconography

### Icon Library

**Lucide React** (`lucide-react` v1.20.0) is the icon system. All icons are stroke-based, consistent in weight, and render at small sizes cleanly.

### Current Icon Usage

| Context | Icon | Notes |
|---------|------|-------|
| Sidebar wordmark mark | `Sparkles` | **Placeholder** — replace with custom newspaper mark |
| Content Calendar | `Calendar` | |
| Analytics | `BarChart3` | |
| Content Library | `Library` | |
| Brand Brain | `Brain` | |
| Integrations | `Plug` | |
| Profile | `User` | |
| Brand Settings | `Settings` | |
| Admin | `Shield` | |
| Admin wordmark mark | `Crown` | Admin-only, not user-facing brand |
| Lock (tier-gated) | `Lock` | |
| Theme toggle | `Sun` / `Moon` / `Monitor` | |

### Icon Sizing

- Navigation: `h-5 w-5` (20px)
- Inline with text: `h-4 w-4` (16px)
- Feature highlights: `h-8 w-8` (32px)
- Always use `shrink-0` on icons in flex layouts to prevent compression

---

## 10. Voice & Tone

### Editorial Voice

The app speaks like a trusted local editor — confident, direct, encouraging, never corporate.

| Do | Don't |
|----|-------|
| "Your town's front page is ready." | "Your content calendar has been generated successfully." |
| "No posts scheduled for today. The front page is yours to fill." | "You have no scheduled posts. Click the button to create one." |
| "Be the local authority." | "Maximize your local market presence." |
| "Every town needs a trusted voice. Become it." | "Leverage our platform to establish thought leadership." |

### Principles

1. **Short sentences.** Like a good headline.
2. **Active voice.** "You publish" not "Content is published."
3. **Encouraging, not commanding.** "Your front page is yours to fill" not "You must create content."
4. **Newspaper metaphors, sparingly.** "Today's Edition," "front page," "the post" — used as flavor, not forced into every string.
5. **No jargon.** No "leverage," "synergy," "optimize," "utilize." Speak like a person, not a marketing deck.

---

## 11. Motion & Animation

### Principles

- **Subtle and purposeful.** Motion should guide attention, not decorate.
- **Fast.** Transitions are 150–300ms. Nothing lingers.
- **No bounce or spring.** The editorial aesthetic is confident and clean, not playful.

### Implemented Patterns

| Pattern | Implementation |
|---------|---------------|
| Tagline rotation | `fade-in` + `transition-opacity duration-500` every 4 seconds |
| Mobile menu drawer | `transform transition-transform duration-200 ease-in-out` |
| Button hover | `transition-colors` (instant-feeling color shift) |
| Input focus | `transition-all` with ring + border color shift |
| Nav active state | `transition-colors` |
| Theme switch | `disableTransitionOnChange` — instant, no flash |

### Easing

- Default: `ease-in-out` for UI transitions
- Drawer: `ease-in-out` for slide animations
- Never use `bounce` or `spring` easing

---

## 12. Dark Mode: "Night Edition"

### Concept

Dark mode is labeled **"Night Edition"** — a nod to the afternoon/evening paper that used to hit newsstands later in the day. It's not just an inverted theme; it's an editorial choice.

### Implementation

- Powered by `next-themes` with `attribute="class"` and `defaultTheme="light"`
- Toggles via the three-way `ThemeToggle` component (Light / Night / System)
- CSS variables are overridden under `.dark` class in `globals.css`
- The `ThemeProvider` in `src/components/ThemeProvider.tsx` wraps the entire app
- All components use semantic CSS variable tokens (e.g., `bg-background-primary`, `text-text-primary`) — no hardcoded colors in user-facing components

### Rules

- **Never hardcode hex values in user-facing components.** Always use the semantic tokens so dark mode works automatically.
- The admin panel is the only exception — it uses hardcoded dark colors (`#0a0a0a`, `#111111`, `#c8952a`) because it is always dark and always behind the scenes.
- The `LockedTabOverlay` component also has a hardcoded `#c8952a` button — this should be migrated to use `accent-primary` or a dedicated admin/upgrade token.

---

## 13. Technical Implementation

### Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.9 |
| UI Library | React | 19.2.4 |
| Styling | TailwindCSS v4 | 4.x |
| Theme Provider | next-themes | 0.4.6 |
| Icons | lucide-react | 1.20.0 |
| Component Variants | class-variance-authority | 0.7.1 |
| Class Merging | clsx + tailwind-merge | |
| Fonts | next/font/google (Playfair Display, DM Sans) | |
| Rich Text | Tiptap (@tiptap/react + extensions) | 3.27.x |
| Charts | Recharts | 3.8.1 |

### CSS Architecture

TailwindCSS v4 uses the `@theme` directive in `globals.css` instead of a `tailwind.config.js` file. All design tokens are defined as CSS variables under `@theme`, which makes them available as Tailwind utility classes (e.g., `--color-accent-primary` → `bg-accent-primary`, `text-accent-primary`, `border-accent-primary`).

### Token Reference

All tokens are defined in `src/app/globals.css`:

```css
@theme {
  --font-sans: var(--font-dm-sans), "DM Sans", sans-serif;
  --font-serif: var(--font-playfair), "Playfair Display", serif;

  --color-background-primary: #FFFFFF;
  --color-background-secondary: #F7F9FC;
  --color-background-card: #FFFFFF;
  --color-accent-primary: #1E56D6;
  --color-text-primary: #101418;
  --color-text-muted: #5B6472;
  --color-brand-personal: #C23E54;
  --color-brand-expert: #B97300;
  --color-brand-local: #0E7C7B;
  --color-border-primary: #E2E8F0;
  --color-border-secondary: #CBD5E1;
}
```

### Key Files

| File | Purpose |
|------|---------|
| `src/app/globals.css` | Design tokens, dark mode overrides, rich text styles |
| `src/app/layout.tsx` | Font loading (Playfair Display + DM Sans), root layout, metadata |
| `src/components/ThemeProvider.tsx` | next-themes provider (class strategy, light default) |
| `src/components/ThemeToggle.tsx` | Three-way light/night/system toggle |
| `src/components/ui/button.tsx` | Button component with cva variants |
| `src/components/RotatingTagline.tsx` | Rotating tagline display (4 brand taglines) |
| `src/components/LockedTabOverlay.tsx` | Tier-gated feature overlay |
| `src/app/manifest.ts` | PWA manifest (name, colors, icons) |
| `src/app/dashboard/layout.tsx` | Dashboard shell (sidebar, nav, wordmark) |
| `src/app/admin/layout.tsx` | Admin shell (separate dark theme) |
| `src/app/login/page.tsx` | Login screen (wordmark, tagline, auth form) |
| `public/icon.svg` | App icon (**placeholder — needs replacement**) |

---

## 14. What's Implemented vs. What's Needed

### Already Live in the Codebase

- [x] "The Local Post" name in metadata, manifest, sidebar, login, admin
- [x] Playfair Display (serif) + DM Sans (sans-serif) font pairing
- [x] Light editorial color palette (`#FFFFFF`, `#F7F9FC`, `#101418`, `#5B6472`, `#1E56D6`)
- [x] Night Edition dark mode with brighter blue (`#2E5BFF`)
- [x] 60/30/10 usage pattern (white dominant, ink text, blue accents only)
- [x] All headings use Playfair Display via global CSS rule
- [x] Rotating taglines on login screen (all 4 brand taglines)
- [x] Content pill colors (Personal, Expert, Local)
- [x] Semantic CSS variable tokens (no hardcoded colors in user-facing UI)
- [x] Button system (default/outline/ghost/secondary)
- [x] PWA manifest with correct name and theme color
- [x] Editorial rich text styles (Tiptap content with serif headings, accent-blue blockquotes)

### Needs Replacement / Creation

- [ ] **App icon** (`public/icon.svg`) — currently a placeholder with old CoreOS gold/dark branding. Needs a newspaper-themed mark in the brand palette.
- [ ] **Sidebar mark** — currently uses `Sparkles` icon as placeholder. Needs a custom newspaper/location-pin mark.
- [ ] **Masthead treatment** — not yet implemented on any surface. Should be created for marketing/landing pages.
- [ ] **"Today's Edition" framing** — calendar and content feed should incorporate editorial framing (datelines, section labels, front-page energy).
- [ ] **Favicon set** — only `icon.svg` exists. Need 16×16, 32×32, 180×180 (Apple touch), and 512×512 variants.
- [ ] **OG/social preview image** — no Open Graph image exists yet. Should feature the wordmark in Playfair Display on a white background with the blue accent.
- [ ] **LockedTabOverlay button** — uses hardcoded `#c8952a` (admin gold) instead of brand accent. Should use `bg-accent-primary`.
- [ ] **Email templates** — Resend is installed but no branded email templates exist. Should use Playfair Display for headers, DM Sans for body, brand palette.

---

## 15. Do / Don't

### Do

- Use Playfair Display for anything that feels like a headline, title, or editorial moment
- Use DM Sans for everything else
- Keep blue (`#1E56D6`) for interactive elements only — buttons, links, active states, progress
- Use `uppercase tracking-wider text-xs` for section labels — it's the newspaper section header convention
- Use thin rules (`border-border-primary`) as dividers between major sections
- Let white space breathe — the premium feeling comes from restraint
- Use the semantic CSS tokens (`bg-background-primary`, `text-text-primary`, etc.) so dark mode works automatically

### Don't

- Don't use the blue as a large background fill — it breaks the 60/30/10 rule and kills the premium feel
- Don't use vintage textures, paper grain, or sepia tones — the newspaper is the soul, not the skin
- Don't use decorative serifs or flourishes beyond Playfair Display — one serif, one sans, that's the system
- Don't hardcode hex values in user-facing components — use tokens
- Don't use drop shadows for depth — use the off-white secondary background behind white cards instead
- Don't mix `#1E56D6` and `#2E5BFF` in the same theme — light uses the deeper blue, dark uses the brighter blue
- Don't use the admin gold (`#c8952a`) or admin dark palette (`#0a0a0a`) in any user-facing screen
- Don't use bounce/spring animations — the editorial aesthetic is clean and confident
- Don't reference "Core Coaching & Investments" or any parent brand in the app UI

---

*The Local Post. Your town. Your post.*
