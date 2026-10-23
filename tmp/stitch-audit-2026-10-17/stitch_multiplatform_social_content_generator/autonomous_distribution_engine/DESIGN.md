---
name: Autonomous Distribution Engine
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#7bd0ff'
  on-tertiary: '#00354a'
  tertiary-container: '#009bd1'
  on-tertiary-container: '#002d40'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-xl:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: '0'
  label-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
  code-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

The design system embodies precision, executive authority, and autonomous workflow clarity. Built for corporate marketing directors, high-output executive teams, and content operations agencies, the interface prioritizes dense, actionable telemetry over decorative noise.

The aesthetic fuses modern executive minimalism with developer-tool utility (inspired by the tactile discipline of Linear and the restrained financial polish of Stripe). It projects calculated intelligence: dark slate tonal surfaces, micro-borders with crisp hairline contrast, disciplined data density, and controlled cobalt accents that signal programmatic execution rather than superficial gamification. The interface feels like a mission control cockpit: sober, high-throughput, and rigorously balanced.

## Colors

The palette operates on a calibrated dark-slate spectrum engineered to minimize visual fatigue during prolonged scheduling and editorial sessions.

- **Background Canvas & Tiers:**
  - `Canvas Main`: `#090d16` (Deep Obsidian Slate)
  - `Surface Layer 1`: `#0f172a` (Base card and panel surface)
  - `Surface Layer 2`: `#1e293b` (Elevated modals, dropdowns, and table headers)
  - `Surface Layer 3`: `#27354a` (Hover states and active interactive segments)
- **Borders & Dividers:**
  - `Border Hairline`: `rgba(255, 255, 255, 0.08)` for container boundaries.
  - `Border Interactive`: `rgba(255, 255, 255, 0.16)` on hover/focus.
- **Accents & Telemetry:**
  - `Primary (Cobalt Engine)`: `#3b82f6` reserved strictly for primary system triggers, pipeline generation states, and active channel indicators.
  - `Titanium Metal`: `#94a3b8` used for secondary structural iconography and structural text.
  - `Sky Tertiary`: `#38bdf8` reserved for live streaming/API status pings and processing badges.
- **Semantic Channels & Statuses:**
  - `LinkedIn`: `#0a66c2`
  - `X (Twitter)`: `#e2e8f0` (Monochrome Slate White)
  - `YouTube`: `#ef4444`
  - `TikTok`: `#00f2fe`
  - `Success (Published)`: `#10b981`
  - `Warning / Queue Lag`: `#f59e0b`

## Typography

The type system balances technical crispness with long-form editorial legibility:

- **Geist** governs headlines, operational metrics, tabular numbers, navigation nodes, and status labels. Its tight tracking and surgical aperture alignment evoke IDE and command-line speed.
- **Inter** provides sustained readability across long AI-generated prompt previews, multi-channel post copy revisions, and analytical breakdowns.
- Tabular figures (`font-variant-numeric: tabular-nums`) must be applied to all schedule timestamps, performance analytics metrics, character count limits, and token counters to eliminate layout jitter during live updates.

## Layout & Spacing

The layout is built on a high-density, 12-column adaptive grid designed to host multi-pane editorial workflows:

- **Desktop (>= 1280px):** Fixed left utility bar (64px collapsed / 240px expanded), central canvas fluid 12-column layout (1.5rem gutters, 2rem margins), and a contextual slide-over drawer (380px) for AI prompt adjustments and channel validation simulators.
- **Tablet (768px - 1279px):** 8-column layout with 1rem gutters. Sidebars fold into an icon rail, and the inspector drawer converts into a toggleable modal sheet.
- **Mobile (< 768px):** Single-column stacked stack with 1rem canvas padding. Tabbed navigation replaces split panels to allow focused review of drafts before execution.
- Spacing values adhere to a strict 4px base increment (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 12px, `space-lg` = 20px, `space-xl` = 32px) maintaining consistent visual rhythm between metric tiles, prompt inputs, and calendar slots.

## Elevation & Depth

Visual hierarchy is constructed through tonal surface stepping and luminous micro-hairlines, completely eliminating muddy drop-shadows:

- **Base Layer (L0):** `#090d16` — App viewport canvas.
- **Surface Layer (L1):** `#0f172a` bordered by `1px solid rgba(255, 255, 255, 0.07)` — Content cards, calendar grids, and pipeline swimlanes.
- **Floating Layer (L2):** `#1e293b` bordered by `1px solid rgba(255, 255, 255, 0.12)` with an ambient soft bloom: `box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.05)` — Active multi-channel preview modals, command palette (`Cmd + K`), and prompt parameter sheets.
- **Interactive Focus:** Activated elements receive an inner cobalt refraction (`box-shadow: inset 0 0 0 1px #3b82f6, 0 0 16px -4px rgba(59, 130, 246, 0.4)`) reinforcing systemic feedback.

## Shapes

The design system enforces a soft, highly disciplined geometry (`roundedness: 1`). 

- Default interactive controls, input inputs, and standard metric cards utilize `0.25rem` (4px) to `0.375rem` (6px) corner radiuses.
- Larger container surfaces (content calendar cards, channel preview viewports, dialog sheets) use `0.5rem` (8px).
- Pill shapes are rejected for structural containers and reserved exclusively for inline micro-status badges (e.g., `Queued`, `Published`, `Tokens Remaining`). This keeps the platform grounded in enterprise tooling rather than consumer social software.

## Components

### Buttons
- **Primary:** Solid cobalt background (`#3b82f6`), crisp white text (`#ffffff`), hairline top highlight (`border-top: 1px solid rgba(255, 255, 255, 0.2)`). Hover transitions to `#2563eb` with micro-glow.
- **Secondary / Ghost:** Transparent base with `#1e293b` fill, text `#94a3b8`, border `rgba(255, 255, 255, 0.08)`. Hover lifts border to `rgba(255, 255, 255, 0.2)` and text to `#f8fafc`.
- **Dimensions:** Compact 32px height for operational actions; 40px height for primary publishing triggers.

### Chips & Badges
- **Status Badges:** Subtle tinted backdrops at 10% opacity paired with vivid hairline text (e.g., AI Processing: `rgba(56, 189, 248, 0.1)` with `#38bdf8` text).
- **Network Identifier Chips:** Muted slate tokens featuring channel glyphs (LinkedIn, X, YouTube, TikTok) with a small active pipeline dot indicator.

### Input Fields & Prompt Editors
- Background `#0b1120`, border `rgba(255, 255, 255, 0.1)`. Height 36px for single-line controls.
- Long-form AI prompt editors feature monospaced prompt token selectors, character/token telemetry meters fixed at bottom-right, and instantaneous validation borders (turning cobalt when active, amber when near channel character caps).

### Checkboxes & Segmented Toggles
- Square 16px containers with `0.25rem` corners. Unchecked: `rgba(255, 255, 255, 0.15)` border. Checked: `#3b82f6` fill with an optical-white vector mark.
- Segmented platform switchers use a recessed `#0b1120` track with a floating `#1e293b` selected slider.

### Cards & Pipeline Views
- Outer card uses `#0f172a` with a subtle top border gradient (`linear-gradient(90deg, rgba(59, 130, 246, 0.3) 0%, rgba(255, 255, 255, 0.03) 100%)`) to delineate AI-generated drafts.
- Header groups display timestamp, target channel icon set, and quality score indicator.

### Specialized AI & Scheduling Components
- **Cross-Platform Preview Matrix:** Quad-split view simulating exact platform renderings (character truncation on X, first-3-line fold on LinkedIn, short title cutoff on YouTube/TikTok) without switching tabs.
- **Generation Diff Inspector:** Side-by-side terminal-style diff highlighting automated AI tone revisions against master seed copy.