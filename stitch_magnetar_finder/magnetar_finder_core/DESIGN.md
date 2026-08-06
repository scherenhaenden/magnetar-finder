---
name: Magnetar Finder Core
colors:
  surface: '#0d1515'
  surface-dim: '#0d1515'
  surface-bright: '#333b3b'
  surface-container-lowest: '#080f10'
  surface-container-low: '#151d1e'
  surface-container: '#192122'
  surface-container-high: '#232b2c'
  surface-container-highest: '#2e3637'
  on-surface: '#dce4e4'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#dce4e4'
  inverse-on-surface: '#2a3232'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dbe7'
  primary: '#e1fdff'
  on-primary: '#00363a'
  primary-container: '#00f2ff'
  on-primary-container: '#006a71'
  inverse-primary: '#00696f'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#fff6e4'
  on-tertiary: '#3b2f00'
  tertiary-container: '#fed83a'
  on-tertiary-container: '#725e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#74f5ff'
  primary-fixed-dim: '#00dbe7'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffe173'
  tertiary-fixed-dim: '#e8c423'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#554500'
  background: '#0d1515'
  on-background: '#dce4e4'
  surface-variant: '#2e3637'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1440px
---

## Brand & Style

The design system is engineered for high-precision scientific exploration and data analysis. It targets astrophysicists and data researchers who require a tool that feels as powerful as the phenomena they study. The emotional response should be one of "controlled intensity"—evoking the immense gravity and magnetic fields of a magnetar through a stable, professional lens.

The visual style is **Modern / Tech-Industrial**, prioritizing utility over decoration. It utilizes deep, "infinite" blacks and navies to create a high-contrast environment where critical data points vibrate with clarity. The aesthetic is grounded in scientific rigor, avoiding unnecessary flourishes in favor of geometric precision and systematic density.

## Colors

This design system utilizes a **dark-first palette** to minimize eye strain during long-duration observation and to maximize the luminance of data visualizations.

- **Primary (Pulsar Cyan):** Used strictly for interactive elements, active states, and critical data highlights. It represents energy and focus.
- **Background (Deep Space Navy):** A near-black navy that provides a high-contrast foundation for the UI.
- **Surface (Slate Grays):** Tiered grays are used to differentiate UI layers. Borders should use a low-opacity slate to maintain a "stealth" appearance.
- **Functional Colors:** Success (Emerald), Warning (Amber), and Error (Crimson) should be desaturated to fit the technical aesthetic, only gaining full vibrance when user intervention is required.

## Typography

The typography system is optimized for high information density.

- **Headlines:** Use **Geist** for a sharp, technical feel in titles and hero stats.
- **Body:** **Inter** is the workhorse for all descriptive text, providing maximum legibility at small scales.
- **Data & Metrics:** **JetBrains Mono** is utilized for all numerical data, coordinates, and timestamps. This ensures that columns of figures align perfectly in tables and dashboards.
- **Hierarchy:** Use "Label Caps" for section headers and table column headers to create a clear structural distinction from the data itself.

## Layout & Spacing

This design system employs a **12-column fluid grid** with a strict 4px base unit.

- **Density:** High-density layouts are preferred. Padding in data tables should be kept to a minimum (8px vertical) to maximize visible rows.
- **Grid Models:** Sidebars are fixed-width (240px or 280px), while the main data stage is fluid.
- **Breakpoints:**
  - Mobile (<640px): Single column, margins reduced to 16px.
  - Tablet (640px - 1024px): 8-column grid, margins 24px.
  - Desktop (>1024px): 12-column grid, margins 32px.
- **Information Grouping:** Use "Content Blocks" with 24px gaps to separate different logical modules of the research dashboard.

## Elevation & Depth

To maintain a grounded, scientific feel, this design system avoids traditional drop shadows. Depth is communicated through **Tonal Layering** and **Line Work**:

- **Level 0 (Base):** `surface-container-lowest` (#080F10).
- **Level 1 (Card/Section):** `surface-container` (#192122) with a 1px solid `outline-variant` border (#3A494B).
- **Level 2 (Popovers/Modals):** `surface-container-high` (#232B2C) with a subtle `primary-fixed-dim` (#00DBE7) outer glow (2px blur, 10% opacity) to simulate active radiation.
- **Interactive States:** Use "Interior Glows" (inner shadows) or stroke weight changes rather than lifting elements off the Z-axis. This keeps the UI feeling like a flat, precision instrument panel.

## Shapes

The shape language is **Industrial and Rigid**.

- **Corners:** A "Soft" setting (4px radius) is applied to standard buttons and input fields to keep them approachable but professional.
- **Data Containers:** Large data modules and panels should use the 4px radius.
- **Status Indicators:** Use sharp 0px corners or perfect circles for status pips to differentiate "system status" from "UI controls."
- **Selection States:** Active tabs or selected rows should use sharp vertical "accent bars" (2px wide) of Pulsar Cyan on their leading edge.

## Components

### Data Tables
Tables are the core of the experience. They must feature:
- Sticky headers with a semi-transparent blur.
- Zebra striping using subtle tonal shifts.
- Monospaced font for all numerical columns.
- Hover states that highlight the entire row in a low-opacity Cyan.

### Search & Filter Groups
Complex search inputs should be "Modular Chips." When a user adds a parameter (e.g., "Magnitude > 15"), it converts into a persistent chip within the search bar. Use high-contrast borders for these groups to indicate they are "Input Zones."

### Timeline View
Timelines use a continuous horizontal axis. Events are marked with Pulsar Cyan diamonds. Drag-and-drop handles for time-range selection must be large enough for precision clicking, styled with a technical "knurled" texture.

### Action Buttons
- **Primary:** Solid Pulsar Cyan with black text. High visibility.
- **Secondary:** Ghost style (Cyan border, no fill) with Cyan text.
- **Tertiary:** Borderless, Slate text, turning White on hover.

### Progress Gauges
Instead of circular loaders, use horizontal "Segmented Bars" to communicate loading states, evoking a sense of data being processed in packets.
