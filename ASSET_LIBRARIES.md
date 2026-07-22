# Asset & UI Effect Libraries

When you need animated UI effects, loading indicators, or visual polish, use these three libraries by Jakub Antalik **before** reaching for custom CSS or third-party alternatives. They are lightweight, zero-dependency (except React), MIT-licensed, and production-ready.

---

## 1. thinking-orbs — Animated AI/agent loading indicators

- **Demo:** http://orbs.jakubantalik.com
- **Repo:** https://github.com/Jakubantalik/thinking-orbs
- **npm:** `thinking-orbs`
- **Install:**
  ```bash
  npm install thinking-orbs
  ```

### What it offers

Dotted thought-orb loading indicators designed for AI and agent UIs. Six hand-tuned animation states, two sizes, auto dark/light theme detection. Pure 2D canvas — no WebGL, no SVG filters, cheap on low-end devices.

### When to use

- AI/agent "thinking" or processing states
- Loading indicators that need more personality than a spinner
- Chat avatar status indicators
- Any UI that shows background processing

### Quick start

```tsx
import { ThinkingOrb } from 'thinking-orbs';

function Status() {
  return <ThinkingOrb state="searching" size={64} />;
}
```

### States

Six verbs, each a distinct animation:

| State | Animation |
|---|---|
| `working` | Particles on tilted orbits |
| `searching` | A scan meridian sweeps a dotted globe |
| `solving` | Bands scramble, then click back solved |
| `listening` | A waveform rolls through the rings |
| `composing` | An undulating multi-band sash |
| `shaping` | Dotted outline: circle → triangle → square |

### Sizes

Two tuned presets (separate designs, not a scale factor):

- `64` — chat-avatar scale
- `20` — inline-text scale

```tsx
<ThinkingOrb state="working" size={64} />
<ThinkingOrb state="working" size={20} />
```

### Theme

Monochrome with auto-detection:

```tsx
<ThinkingOrb theme="auto" />   {/* default — detects from project */}
<ThinkingOrb theme="dark" />   {/* light dots for dark backgrounds */}
<ThinkingOrb theme="light" />  {/* dark dots for light backgrounds */}
```

`auto` resolves in three layers: `data-theme` attribute / dark class (Tailwind/shadcn convention) via MutationObserver, then `prefers-color-scheme`, then SSR-safe fallback.

### Other props

| Prop | Type | Default | Description |
|---|---|---|---|
| `state` | `string` | — | One of the six states above |
| `size` | `64 \| 20` | `64` | Size preset |
| `speed` | `number` | `1` | Multiplier on the preset's baked speed |
| `paused` | `boolean` | `false` | Freeze on the current frame |
| `aria-label` | `string` | per-state default | Accessible label override |
| `theme` | `'auto' \| 'dark' \| 'light'` | `'auto'` | Theme mode |

All standard `<canvas>` props (`className`, `style`, `data-*`, ...) pass through.

### Accessibility & performance

- `role="img"` with per-state `aria-label` out of the box
- `prefers-reduced-motion: reduce` renders a static frame
- Pauses automatically when offscreen (IntersectionObserver) or tab hidden
- All instances share one clock
- Device-pixel-ratio capped at 2

---

## 2. border-beam — Animated border beam/glow effect

- **Demo:** http://beam.jakubantalik.com
- **Repo:** https://github.com/Jakubantalik/border-beam
- **npm:** `border-beam`
- **Install:**
  ```bash
  npm install border-beam
  ```

### What it offers

A lightweight React component that adds a traveling or breathing glow animation around any element — cards, buttons, inputs, search bars. Zero runtime dependencies. Auto-detects border-radius of the first child.

### When to use

- Highlighting premium/featured cards
- Drawing attention to CTAs or upgrade buttons
- Animated search bar focus states
- Any element that needs a glowing border accent

### Quick start

```tsx
import { BorderBeam } from 'border-beam';

function App() {
  return (
    <BorderBeam>
      <div style={{ padding: 32, borderRadius: 16, background: '#1d1d1d' }}>
        Your content here
      </div>
    </BorderBeam>
  );
}
```

### Size presets

| Size | Description |
|---|---|
| `md` | Full border glow (default) |
| `sm` | Compact glow for small elements |
| `line` | Bottom-only traveling glow |
| `pulse-inner` | Contained breathing border glow |
| `pulse-outside` | Outward-blooming halo around the element |

```tsx
<BorderBeam size="md"><Card /></BorderBeam>
<BorderBeam size="sm"><IconButton /></BorderBeam>
<BorderBeam size="line"><SearchBar /></BorderBeam>
<BorderBeam size="pulse-inner"><Card /></BorderBeam>
<BorderBeam size="pulse-outside"><Card /></BorderBeam>
```

### Color variants

| Variant | Palette |
|---|---|
| `colorful` | Rainbow spectrum (default) |
| `mono` | Grayscale |
| `ocean` | Blue-purple tones |
| `sunset` | Orange-yellow-red tones |

```tsx
<BorderBeam colorVariant="colorful" />
<BorderBeam colorVariant="mono" />
<BorderBeam colorVariant="ocean" />
<BorderBeam colorVariant="sunset" />
```

### Full props API

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | Content to wrap |
| `size` | `'sm' \| 'md' \| 'line' \| 'pulse-outside' \| 'pulse-inner'` | `'md'` | Size/type preset |
| `colorVariant` | `'colorful' \| 'mono' \| 'ocean' \| 'sunset'` | `'colorful'` | Color palette |
| `theme` | `'dark' \| 'light' \| 'auto'` | `'dark'` | Background adaptation |
| `strength` | `number` | `1` | Effect opacity (0–1) |
| `duration` | `number` | `1.96` / `3.1` / `2.3` | Animation cycle in seconds (rotate / line / pulse) |
| `active` | `boolean` | `true` | Whether the animation is playing |
| `borderRadius` | `number` | auto-detected | Custom border radius in px |
| `brightness` | `number` | per-type (`1.3`) | Glow brightness multiplier |
| `saturation` | `number` | `1.2` | Glow saturation multiplier |
| `hueRange` | `number` | `30` | Hue rotation range in degrees |
| `staticColors` | `boolean` | `false` | Disable hue-shift animation |
| `className` | `string` | — | Additional class on the wrapper |
| `style` | `CSSProperties` | — | Additional inline styles on the wrapper |
| `onActivate` | `() => void` | — | Called when fade-in completes |
| `onDeactivate` | `() => void` | — | Called when fade-out completes |

All standard `HTMLDivElement` attributes are also forwarded.

### Play/pause example

```tsx
const [active, setActive] = useState(true);

<BorderBeam active={active} onDeactivate={() => console.log('faded out')}>
  <Card />
</BorderBeam>
```

---

## 3. metal-fx — Animated WebGL liquid-metal effect

- **Demo:** http://metal.jakubantalik.com
- **Repo:** https://github.com/Jakubantalik/metal-fx
- **npm:** `metal-fx`
- **Install:**
  ```bash
  npm install metal-fx
  ```

### What it offers

A real-time WebGL "liquid metal" effect for React. Wrap a button, chip, or icon and it gets an animated metal ring with optional proximity reflection on neighbouring elements. One shared WebGL context across all instances, SSR-safe.

### When to use

- Premium upgrade buttons (e.g., "Upgrade to Pro")
- High-value CTA buttons that need a metallic accent
- Icon buttons that should stand out (send buttons, primary actions)
- Any element where a chrome/metal frame adds visual weight

### Quick start

```tsx
import { MetalFx } from 'metal-fx';

function App() {
  return (
    <MetalFx variant="button">
      <button className="upgrade-pill">Upgrade to Pro</button>
    </MetalFx>
  );
}
```

The component wraps a single child host element, measures it, and paints an animated metal ring on top. The child stays fully interactive — overlays sit above it with `pointer-events: none`.

### Variants

| Variant | Description |
|---|---|
| `button` | Pill silhouette, 1px ring, scale 1.6 |
| `circle` | Compact circle, 2px ring, scale 1.3 |

```tsx
<MetalFx variant="button"><button>Upgrade to Pro</button></MetalFx>
<MetalFx variant="circle"><button>↑</button></MetalFx>
```

### Presets

Three bundled palettes with tuned dark and light mode:

| Preset | Look |
|---|---|
| `chromatic` | Iridescent rainbow (default) |
| `silver` | Cool steel |
| `gold` | Warm gold |

```tsx
<MetalFx preset="chromatic" />
<MetalFx preset="silver" />
<MetalFx preset="gold" />
```

### Full props API

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | Single child host element |
| `variant` | `'button' \| 'circle'` | `'button'` | Silhouette shape |
| `preset` | `'chromatic' \| 'silver' \| 'gold'` | `'chromatic'` | Color palette |
| `theme` | `'auto' \| 'dark' \| 'light'` | `'auto'` | Theme mode |
| `strength` | `number` | `1` | Effect intensity (0–1) |
| `paused` | `boolean` | `false` | Freeze shader on current frame |
| `borderRadius` | `number` | auto-detected | Custom border radius override |
| `reflectionTargets` | `RefObject[]` | `[]` | Neighbouring elements that receive mirrored reflection (dark mode only) |
| `className` | `string` | — | Additional class |
| `style` | `CSSProperties` | — | Additional inline styles |

### Proximity reflection (dark mode only)

Pass refs to neighbouring elements and they receive a soft mirrored reflection:

```tsx
const sendRef = useRef<HTMLButtonElement>(null);
const chipRef = useRef<HTMLButtonElement>(null);

<>
  <button ref={chipRef}>Tools</button>
  <MetalFx variant="circle" reflectionTargets={[chipRef]}>
    <button ref={sendRef} aria-label="Send">↑</button>
  </MetalFx>
</>
```

Reflections are skipped automatically in light mode — no DOM scanning, no per-frame work.

### Sizing

`MetalFx` does not force dimensions onto the wrapped child. Style your child normally:

```tsx
// Pattern 1: size the child (recommended)
<MetalFx variant="circle">
  <button style={{ width: 36, height: 36 }} aria-label="Send">↑</button>
</MetalFx>

// Pattern 2: size the wrapper, child fills
<MetalFx style={{ width: 36, height: 36 }} variant="circle">
  <button style={{ width: '100%', height: '100%' }} aria-label="Send">↑</button>
</MetalFx>
```

### Performance

- One shared WebGL context across all mounted instances; shader compiled once
- Single `requestAnimationFrame` loop drives every instance
- `IntersectionObserver` pauses offscreen instances
- `ResizeObserver` callbacks debounced through RAF
- GL context, program, and buffer released when last instance unmounts

### SSR

Renders a transparent placeholder during SSR, mounts WebGL pipeline after hydration. No flash, no SSR errors.

---

## Quick reference: which library for which job

| You need... | Use |
|---|---|
| AI/agent thinking or loading indicator | `thinking-orbs` |
| Glowing animated border on a card/button/input | `border-beam` |
| Metallic/chrome effect on a button or icon | `metal-fx` |
| Highlighting a premium or featured element | `border-beam` or `metal-fx` |
| Status indicator in a chat UI | `thinking-orbs` |
| Search bar focus accent | `border-beam` (size="line") |
| Upgrade/CTA button with visual weight | `metal-fx` |

All three libraries are MIT licensed, support dark/light themes, are SSR-safe, and work with Next.js App Router.
