---
name: Nexus Creator
description: A free, browser-based photo/video/audio toolkit redesigned around the multitool metaphor — one compact instrument, many blades.
colors:
  matte-black-ground: "#0d0e10"
  panel-surface: "#16181b"
  card-surface: "#1c1f22"
  elevated-surface: "#24282c"
  pivot-red: "#e63328"
  pivot-red-bright: "#ff5245"
  brushed-steel: "#8b929c"
  brushed-steel-bright: "#c9cfd5"
  hairline-border: "#2a2d31"
  hairline-border-strong: "#383c41"
  primary-text: "#eef0f2"
  muted-text: "#8b929c"
  status-green: "#3ecf7a"
  status-amber: "#f2a93c"
  status-blue: "#4a90e2"
typography:
  display:
    fontFamily: "Archivo, sans-serif"
    fontSize: "clamp(28px, 5.5vw, 58px)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Archivo, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "2px"
  measurement:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "8px-9px"
    letterSpacing: "1.5px"
rounded:
  sm: "2px"
  md: "3px"
  lg: "6px"
  blade: "5px 5px 3px 3px"
  plate: "14px"
components:
  button-primary:
    backgroundColor: "linear-gradient({colors.pivot-red-bright}, {colors.pivot-red})"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "11px 24px"
  button-outline:
    backgroundColor: "linear-gradient({colors.elevated-surface}, {colors.card-surface})"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.md}"
    padding: "11px 20px"
---

# Design System: Nexus Creator — The Multitool

## Overview

**Creative North Star: "The Multitool"**

One compact instrument, many blades. Nexus Creator's redesign is built on a literal folding multitool: a matte-black casing, brushed-steel blades, and a single red pivot pin holding the whole thing together. The product's actual mechanism — 34 tools folded into one free, no-signup, no-upload browser page — maps directly onto the object. You don't get a dashboard of everything at once; you unfold exactly the blade (Photo, Video, or Audio) you came for, and everything else recedes.

This direction was chosen through Impeccable's concept-seed process: the roll assigned "Tailor's Workbench," a challenger deal offered "Oscilloscope Signal Bench," and the user picked the third option on the table — the model's own top-ranked candidate, "Multitool / Swiss Army Knife" — over both, an honest and legitimate choice of the familiar, effective direction.

This replaces the previous "dark sci-fi HUD" identity (corner brackets, dashed spinning radar rings, a generic near-black + red-glow world). Product truth, copy, and every working feature were preserved; only the visual world changed.

**Key Characteristics:**
- Matte-black tool casing as the ground, never pure black — always a hair of blue-gray in it.
- Brushed-steel gradient as the material signature, used on every "blade" surface: category cards, the hero tool, elevated panels.
- Red is reserved. It marks exactly one thing: the pivot point and the primary action. It is never a background wash.
- Rivets replace corner brackets. Every card corner, the hero's casing corners, and the logo mark carry a small machined rivet-dot rather than a bracket line.
- JetBrains Mono is kept, but re-justified: it now exists only for measured values — pixel offsets, timestamps, percentages — never as a "tech" costume.

## Colors

A near-black steel ground carries the whole system; red appears exactly once per view, at the point of decision.

### Primary
- **Pivot Red** (`#e63328`): the rivet pin, the primary CTA fill, active-state accents. Nowhere else.

### Neutral
- **Matte-Black Ground** (`#0d0e10`): page background (dark theme).
- **Panel Surface** (`#16181b`): nav bar, secondary surfaces.
- **Card Surface** (`#1c1f22`): tool cards, category cards.
- **Elevated Surface** (`#24282c`): hover/active card states, raised chrome.
- **Brushed Steel** (`#8b929c`): the metal-material accent — icon strokes, rivet fill, muted text, secondary borders. This is the system's second color family, doing the work a lot of designs would reach for a second accent hue to do.
- **Brushed Steel Bright** (`#c9cfd5`): the highlight edge of brushed-steel gradients, catching light.
- **Hairline Border** (`#2a2d31`) / **Hairline Border Strong** (`#383c41`): default and hover border weight.
- **Primary Text** (`#eef0f2`): near-white with a cool cast to match the steel world, never pure `#fff`.

### Named Rules
**The One Rivet Rule.** Red is the pivot pin. It appears at exactly the point of primary action or the hinge of an interaction — never as an ambient wash, never on more than one focal element per view.

## Typography

**Display Font:** Archivo (with sans-serif fallback)
**Body Font:** Archivo (with sans-serif fallback)
**Label/Mono Font:** JetBrains Mono, monospace

**Character:** An engineered, machined grotesk — confident at display size, legible and honest at label size. JetBrains Mono is the instrument's own printed numerals: every measurement (crop dimensions, trim timestamps, compression percentages) is set in it, everywhere in the app, so a user always sees exact values next to whatever they're dragging.

### Hierarchy
- **Display** (800, `clamp(28px,5.5vw,58px)`, 1.05 line-height, -0.01em tracking): hero headline only.
- **Label** (700, 10px, 2px tracking, uppercase): nav links, section titles, buttons.
- **Body** (400, 14px, 1.7 line-height): hero subhead, descriptive copy.
- **Measurement** (JetBrains Mono, 8-9px, 1.5px tracking): every numeric readout — crop px, timestamps, badges, tool descriptions.

### Named Rules
**The Measured-Value Rule.** Monospace is never decoration. If a number is on screen — a dimension, a duration, a percent — it's JetBrains Mono. If it's a word, it's Archivo.

## Layout

Unchanged from the incumbent structure: a sticky nav, a full-bleed hero, a 3-up category showcase grid (collapses to 1-column under 900px), and 5-up tool grids (collapsing to 3-up, then 2-up on mobile). The redesign is a material and token change layered onto this existing, already-responsive skeleton — layout grammar was preserved as product truth, not treated as part of the visual world.

## Elevation & Depth

Hybrid: flat card surfaces at rest, with a genuine bevel system on interactive/metal elements. Brushed-steel surfaces (hero blades, category-card plates, primary buttons) always carry an `inset 0 1px 0 rgba(255,255,255,.1-.25)` top highlight plus an outer drop shadow — real material light-catching, not a flat color swap. Cards otherwise stay flat until hover, when they lift 1-3px with a soft shadow.

### Shadow Vocabulary
- **Blade bevel** (`inset 0 1px 0 rgba(255,255,255,.14), 0 8px 16px -8px rgba(0,0,0,.65)`): hero blades, category-card icon plates.
- **Button bevel** (`inset 0 1px 0 rgba(255,255,255,.22), 0 3px 8px -3px rgba(0,0,0,.5)`): primary red button, nav CTA.
- **Rivet inset** (`inset 0 1px 1px rgba(0,0,0,.4)`): every rivet-dot, giving it a punched-metal look.

### Named Rules
**The Catch-Light Rule.** Anything claiming to be metal must show a highlight, not just a fill color. A flat gray rectangle is not brushed steel; a gradient with a lighter sweep and a top inset highlight is.

## Shapes

Corners are small and mechanical (2-6px radius) — this is a tool, not a soft consumer app. The signature recurring form is the **rivet**: a 6-7px circle with a radial highlight and inset shadow, replacing every instance of the old corner-bracket motif (hero casing corners, category-card corners, logo mark). The hero's folded blades use an asymmetric radius (`5px 5px 3px 3px`) — rounded at the exposed tip, nearly square at the hinge, like a real tool blade.

## Components

### Buttons
- **Shape:** 3px radius, mechanical not soft.
- **Primary:** red gradient fill (`linear-gradient(var(--red2),var(--red))`) with an inset top highlight and drop shadow — a pressed-metal button, not a flat color swatch. Lifts 1px on hover with a brightness bump.
- **Outline:** steel-gradient fill (`linear-gradient(var(--bg4),var(--bg3))`), hairline border that brightens to `--steel` on hover.

### Cards / Containers
- **Corner Style:** rivet-dots at two opposing corners (top-left / bottom-right on category cards; all four on the hero casing), not brackets.
- **Background:** `linear-gradient(180deg, var(--bg3), var(--bg2))` on category cards; flat `--bg3` on tool cards.
- **Shadow Strategy:** flat at rest, lifts with a soft red-tinted shadow on hover (category cards only — reserving the red glow for the flagship cards, not every tool tile).

### The Folded Multitool (signature component)
The hero's centerpiece: three brushed-steel "blade" buttons (36×96px) fanned from a single red rivet pivot at a shared bottom-center origin, each rotated ±26° at rest and carrying that category's icon upright (counter-rotated) near its tip. Hovering or focusing the group fans the blades open a further 9° via a shared `--fan` custom property — one authored motion, not per-blade animation. Each blade is a real `<button>` that navigates to its category; the multitool is both decoration and primary navigation, never just illustration.

### Category Icon Blades
The three home-page category cards reuse the hero's blade material at larger scale (78×78px plates with the same brushed-steel gradient, a still bezel ring instead of the old spinning dashed radar ring, and dark laser-etched icon glyphs instead of red icon fills) — the same object, unfolded and enlarged.

## Do's and Don'ts

### Do:
- **Do** keep red to the pivot point and the primary action. If you're reaching for red a second time on the same view, use `--steel` instead.
- **Do** give every brushed-steel surface a light-catching highlight (inset top-light + gradient sweep), never a flat fill.
- **Do** set every measured value (px, seconds, %) in JetBrains Mono.
- **Do** use rivet-dots for corner ornamentation — never corner brackets, never dashed circles.

### Don't:
- **Don't** reintroduce dashed rotating rings, corner brackets, or any other leftover HUD/sci-fi signature from the previous identity — they belong to the discarded world.
- **Don't** use gradient text for emphasis; weight and size carry it.
- **Don't** let the steel-gradient material go flat under a heavy color wash — the highlight sweep must survive.
