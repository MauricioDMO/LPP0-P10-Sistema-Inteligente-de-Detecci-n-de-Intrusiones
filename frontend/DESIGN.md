---
name: SOC Protocol
colors:
  surface: '#10131a'
  surface-dim: '#10131a'
  surface-bright: '#363941'
  surface-container-lowest: '#0b0e15'
  surface-container-low: '#191b23'
  surface-container: '#1d2027'
  surface-container-high: '#272a31'
  surface-container-highest: '#32353c'
  on-surface: '#e1e2ec'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e1e2ec'
  inverse-on-surface: '#2e3038'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#b1c6f9'
  on-secondary: '#182f59'
  secondary-container: '#304671'
  on-secondary-container: '#9fb5e7'
  tertiary: '#ffb786'
  on-tertiary: '#502400'
  tertiary-container: '#df7412'
  on-tertiary-container: '#461f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#b1c6f9'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#304671'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#10131a'
  on-background: '#e1e2ec'
  surface-variant: '#32353c'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-base:
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
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
---

## Brand & Style
This design system is engineered for high-stakes environments where split-second decision-making is paramount. The brand personality is **vigilant, precise, and authoritative**. It avoids unnecessary decorative elements, favoring a high-tech "command center" aesthetic that balances dense data visualization with visual clarity.

The style is a hybrid of **Corporate Modern** and **Technical Glassmorphism**. We utilize deep, layered blacks to provide a void-like canvas where critical alerts can achieve maximum luminosity. Glassmorphism is applied sparingly to overlays and navigation to maintain a sense of depth and sophisticated transparency without compromising the performance of real-time data streams.

## Colors
The palette is optimized for low-light environments typical of Security Operations Centers. The background is a "True Deep Sea" black to reduce eye strain during long shifts. 

- **Primary (Info/Safe):** A technical blue used for navigation and neutral interactions.
- **Critical:** Reserved strictly for active threats and system failures. It must be the highest-luminosity element on the screen.
- **Warning:** Used for anomalies and non-blocking security events.
- **Success/Active:** Indicates healthy systems and live connections.
- **Neutrals:** A range of Slate grays provides structure. Use `#0f172a` for container surfaces and `#1e293b` for subtle borders.

## Typography
The system employs a dual-font strategy. **Inter** handles the UI hierarchy and general content for its exceptional legibility and neutral tone. **JetBrains Mono** is utilized exclusively for technical data, including IP addresses, log entries, hex codes, and performance metrics. 

Large display sizes should be kept to a minimum to maximize "data density" on the dashboard. Use `label-caps` for section headers and table column titles to create a clear structural skeleton for complex views.

## Layout & Spacing
The layout follows a **Strict Fluid Grid** model. Components must align to a 4px baseline to maintain technical precision. 

- **Density:** High. Margins and padding should be kept lean (`12px` to `16px`) to ensure as much information as possible is "above the fold."
- **Desktop:** A 12-column grid allows for complex dashboard configurations (e.g., a 3-column alert sidebar, a 6-column main visualization, and a 3-column metadata panel).
- **Mobile/Tablet:** Dashboard widgets reflow into a single column. Charts should maintain a minimum height of 240px to remain interactive.

## Elevation & Depth
In a deep dark environment, shadows are less effective than light-based hierarchy. We use **Tonal Layering** and **Subtle Strokes**:

1.  **Level 0 (Background):** Base `#020617`.
2.  **Level 1 (Surface):** `#0f172a` with a 1px solid border of `#1e293b`.
3.  **Level 2 (Active/Floating):** Use a subtle Backdrop Blur (12px) with a semi-transparent surface of `rgba(30, 41, 59, 0.7)`.
4.  **Critical Elevation:** Elements with a "Critical" status should have a subtle red outer glow (`0 0 15px rgba(239, 68, 68, 0.2)`) to simulate an emergency beacon effect.

## Shapes
We use **Soft Technical** rounding. The goal is to avoid the "toy-like" feel of high-radius corners while softening the harshness of a pure 0px grid.

- **Base Corner Radius:** 4px (Soft).
- **Large Components (Cards):** 8px.
- **Buttons/Inputs:** 4px.
- **Status Badges:** 2px (Near-sharp) to maintain a serious, utilitarian appearance.

## Components

### Buttons & Inputs
- **Primary Action:** Solid `#3b82f6` with white text.
- **Ghost Action:** Bordered `#1e293b` with `#94a3b8` text, shifting to white on hover.
- **Inputs:** Dark background (`#020617`) with a 1px border. Focus state uses a `primary` color glow.

### Data Badges & Status Indicators
- **Activity Indicators:** Small 8px circles with a "pulse" animation for active data streams. Use the `Success` color for live feeds.
- **Threat Badges:** High-contrast pill shapes using the `Critical` or `Warning` colors. Text inside should be `Inter Bold` and highly legible.

### Cards & Charts
- **Dashboard Cards:** Use the Level 1 Surface style. Header and body should be separated by a 1px horizontal rule.
- **Interactive Charts:** Lines should be 2px thick. Use a gradient area fill (10% opacity) beneath the line to provide visual volume.

### Real-time Logs
- Use `JetBrains Mono`. Alternate row colors with a very subtle highlight (`rgba(255, 255, 255, 0.02)`) for readability in dense lists.