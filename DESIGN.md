---
name: Nexus Creator
description: A free, browser-based photo/video/audio toolkit whose home page is built as a bolted control-panel console — cream plates, black LCD screens, one red accent.
colors:
  void-dark: "#0a0a0a"
  void-light: "#eeece5"
  panel-cream: "#ece7dc"
  panel-cream-light-theme: "#fffdf8"
  screen-black: "#0c0c0d"
  screen-text: "#f2efe4"
  pivot-red: "#e2472c"
  pivot-red-bright: "#ff5c3f"
  ink: "#18140f"
  ink-muted: "#6e6858"
  rivet-metal: "#a19a89"
typography:
  display:
    fontFamily: "Archivo, sans-serif"
    fontWeight: 800
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "9px"
    letterSpacing: "1.5px"
  data:
    fontFamily: "Silkscreen, monospace"
    fontSize: "30px-44px"
rounded:
  panel: "0"
  button-round: "50%"
components:
  lift-button:
    backgroundColor: "radial-gradient({colors.pivot-red-bright}, {colors.pivot-red})"
    textColor: "#ffffff"
    rounded: "{rounded.button-round}"
---

# Design System: Nexus Creator — The Console

## Overview

**Creative North Star: "The Control Panel"**

The home page is a bolted instrument console, not a webpage: cream plates seamed by black gaps, screwed together with visible rivets, each holding a black LCD screen or a real-feeling control. Ordinary product facts — tool count, "0 MB ever uploaded" — are staged as live telemetry readouts, the way a real instrument reports what it's doing. This direction was chosen directly from a user-supplied reference image (a rocket-company product page in this exact control-panel language) and adapted with Nexus's own content, copy, and product facts — not the reference's brand, name, or claims.

This **supersedes** the prior "Multitool" direction (brushed steel, dark-only, red pivot pin) on the home page specifically. The editor, tool-list pages, and nav bar were deliberately left on their existing dark theme in this pass — full app-wide unification is a disclosed follow-up, not done here, to keep the editor's already-working UI at zero risk.

**Key Characteristics:**
- Panels are cream, floating on a void that is black in dark theme / pale in light theme — the panel color itself does not change with theme, only what it floats on.
- Screens are *always* black with off-white dot-matrix text, a real invariant, independent of the theme toggle — a real LCD doesn't change color with room lighting.
- Red is spent once per panel, on the thing that matters: the primary button, one accent block, a status word.
- Every panel corner carries a rivet — a small screw-head circle, replacing every other corner-decoration idea from earlier passes.
- Big numbers are set in Silkscreen (a genuine dot-matrix/LED display face), never Archivo — Archivo is for words, Silkscreen is for values.

## Colors

### Primary
- **Pivot Red** (`#e2472c`): the lift-off button, the categories accent block, warning/status text. Nowhere else.

### Neutral
- **Void** (`#0a0a0a` dark / `#eeece5` light): the page background the panels float on.
- **Panel Cream** (`#ece7dc` dark theme / `#fffdf8` light theme): every panel's surface.
- **Screen Black** (`#0c0c0d`, invariant): every LCD screen, in both themes.
- **Screen Text** (`#f2efe4`, invariant): dot-matrix and label text on screens.
- **Ink** (`#18140f`): body text on cream panels.
- **Ink Muted** (`#6e6858`): secondary text, bullet lines, labels on cream.
- **Rivet Metal** (`#a19a89`): the screw-head accent at every panel corner.

### Named Rules
**The One Screen Rule.** Screens are black in both themes. If a component needs to look "always on," it lives in a `.screen`, not on the panel surface.

## Typography

**Display Font:** Archivo (words: headings, labels, body)
**Data Font:** Silkscreen (numbers only: tool counts, stats, MB uploaded)
**Label/Mono Font:** JetBrains Mono (technical labels — "SELECT LAUNCHER" register, all-caps, letter-spaced)

### Named Rules
**The Value/Word Rule.** If it's a number that means something (a count, a stat), it's Silkscreen. If it's a word — even a single-word label — it's Archivo or JetBrains Mono, never Silkscreen. Mixing them is how a dot-matrix system stops reading as instrumentation and starts reading as a novelty font choice.

## Layout

The console is a CSS grid of unequal-width panels (`1.35fr .8fr 1.35fr 1fr`) seamed by a 3px void gap — collapsing to 2 columns at 900px, 1 column at 600px. A second, two-panel row (`1.1fr 1.9fr`) sits below it. The Toolbelt and Quick Adjust sections below the console pick up the same panel/screen tokens but stay in the existing single-column stacked layout.

## Elevation & Depth

Panels are flat — no shadow, no lift. Depth comes from the void gap between panels (a real seam, not a drop shadow) and from the rivets themselves (`inset 0 1px 1px rgba(0,0,0,.35)`, a punched-metal look). The one thing that DOES get a shadow is the lift-off button, which is a real physical button and needs to look pressable.

### Named Rules
**The Seam, Not Shadow Rule.** Panel-to-panel depth is the black gap between them, never a box-shadow. A panel with a drop shadow floating over another cream panel breaks the "bolted-together plate" read immediately.

## Shapes

Zero border-radius on every panel — these are machined plates, not soft cards. The one deliberate exception is the lift-off button (a perfect circle) and the capsule stat window (fully rounded, a pill/tube shape) — both literal physical objects that are round in life.

## Components

### The Lift-off Button
150×150px circle, radial-gradient red fill with an inset top highlight (a real bevel, not a flat fill), lifts 2px and brightens on hover. This is the console's one unambiguous primary action.

### Rivet
7×7px circle, radial-gradient metal fill with an inset dark top-edge via `::after`, at two or four corners of every panel. The system's single recurring ornamental device — never a corner bracket, never a dashed line.

### Screen
Black background, off-white text, houses a `.screen-label` (small muted mono caption) and a `.dotnum` (the Silkscreen value). Always dark regardless of theme.

### Toolbelt (carried over)
Cream-toned version of the existing consolidated tool-grid section: one container, hairline dividers between Photo/Video/Audio/AI groups instead of four repeated boxed sections.

## Do's and Don'ts

### Do:
- **Do** keep screens black in both themes — this is a hardware invariant, not a color choice.
- **Do** use Silkscreen only for numeric data, never for a label or heading.
- **Do** put a rivet on every panel corner (2 or 4, per panel size).
- **Do** spend red exactly once per panel.

### Don't:
- **Don't** apply box-shadow between adjacent panels — the seam is the depth cue.
- **Don't** round panel corners — only the lift-off button and the capsule window are round.
- **Don't** reintroduce the earlier Multitool blade/fan icon system or its brushed-steel gradients on the home page — that world is retired here, not layered underneath this one.
- **Don't** extend cream panels into the editor/tool-list pages without a deliberate follow-up pass — this system is currently home-page-scoped by design.
