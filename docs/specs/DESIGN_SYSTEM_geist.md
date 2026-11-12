# Design System — Visual Specification & Agent Guide (« Earthy Editorial / Geist »)

Self-contained normative specification for building UI that matches this design system. Hand this file alone to an AI agent or developer: it contains every token, stylesheet, foundation file, and rule needed to reproduce the UI. Do not depend on any external design-system directory or companion file.

- **System ID**: `earthy-editorial-geist`
- **Aesthetic direction**: Calm, earthy editorial hospitality (warm neutral surfaces, deep slate-blue actions, generous whitespace, soft 12px rounding, ink-tinted shadows, restrained motion)
- **Theme polarity**: Light by default (`#FAF8F6` cream canvas) with full dark mode (`#0D0000` ink canvas) via `.dark` class
- **Target stack**: Next.js 15+ (App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui (`new-york`) + Geist (`geist` or `next/font/google`) + `lucide-react` + `next-themes` + `tw-animate-css`

## Agent Execution Contract

1. Treat this document as the single source of truth for this system. Apply rules in this order when they conflict: **§1 non-negotiables → foundation files in §2 → component contracts → composition patterns**.
2. Before editing an existing project, inspect its installed dependencies, aliases, and generated shadcn conventions. Reuse its one established import convention; do not introduce a parallel one. For a new project, follow §2 in order.
3. Implement only the foundation and components required by the requested screen, then validate the finished UI against §14. Never substitute unapproved visual defaults, raw palette utilities, or placeholder data for a documented rule.

---

## 1. Design Intent & Non-Negotiables

A calm, editorial, earthy interface: warm neutral surfaces, deep slate-blue actions, generous whitespace, soft 12px rounding, ink-tinted shadows, and restrained motion. It should feel like a quiet boutique hospitality brand, not a generic SaaS dashboard.

- **Keywords**: earthy, quiet, editorial, organic, warm, understated, premium but not ostentatious.
- **Signature elements**: large rounded photography (`rounded-xl` / `rounded-2xl`) with bottom-up ink gradient overlays, uppercase tracked eyebrow kickers (`tracking-[0.18em]`), dark `brand-ink` manifesto panels with subtle SVG fractal `.grain`, and warm `accent` bands.

### Non-Negotiable Rules

1. **Never pure black or pure white as the page canvas**: cream `#FAF8F6` in light mode, ink `#0D0000` in dark mode.
2. **Semantic tokens only**: never use raw Tailwind palette classes (`bg-blue-500`, `text-gray-400`) or arbitrary hex values in UI components.
3. **Automatic dark mode via tokens**: dark mode is driven by the `.dark` class on `<html>`. Do not write manual `dark:` overrides in product components (except `dark:border dark:border-border` on always-dark `bg-brand-ink` panels, or illustrations). Leave generated shadcn `dark:` classes untouched.
4. **One primary action per view**: secondary actions must use `secondary`, `outline`, or `ghost`. Two primary buttons side by side is a hierarchy error.
5. **Soft radii everywhere**: base `--radius: 0.75rem` (12px). No sharp corners on interactive surfaces. Never over-round a child more than its parent.
6. **Borders at rest, shadows on elevation**: custom cards use a 1px border at rest and gain `shadow-sm` only on hover. Shadows are tinted with ink (`#0D0000`), never pure black.
7. **Three font weights only**: `font-normal` (400), `font-medium` (500), and `font-semibold` (600). Never use `font-bold` or `font-light`.
8. **Never stack opacity on text** (`text-foreground/60`): use `text-muted-foreground`. Only two documented exceptions are permitted, neither below `/70`: `text-accent-foreground/70` on `bg-accent` (4.8:1) and `text-brand-cream/70` on always-dark `bg-brand-ink` panels (9.4:1).

---

## 2. Stack & Project Setup

```bash
pnpm create next-app@latest my-app --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
cd my-app
npx shadcn@latest init        # style: New York, base color: Neutral, CSS variables: yes
pnpm add geist tw-animate-css lucide-react next-themes
npx shadcn@latest add button card input label form badge dialog sheet sonner separator
# Optional — install only when required by the screen:
npx shadcn@latest add drawer sidebar alert tooltip dropdown-menu
```

**Execution order matters**: `shadcn init` rewrites `components.json` and `app/globals.css`. Run it first, then overwrite those files with §2.1 and §2.5. Mount `<Toaster />` in the root layout (§2.4) as soon as `sonner` is installed.

- **Remote images**: if `next/image` loads remote URLs (e.g. Unsplash), declare them in `next.config.ts` under `images.remotePatterns` so runtime rendering does not throw.
- **`cn` helper**: recent shadcn CLI outputs import `cn` from `"cn"` or `@/lib/utils` and Radix primitives from `"radix-ui"`. Follow whichever single source the project initializes across all files.

### 2.1 `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### 2.2 Fonts — `lib/fonts.ts`

Geist Sans for all UI and editorial copy; Geist Mono for code, identifiers, and numeric tables. (Alternative: `next/font/google` with `Geist` and `Geist_Mono` using `variable: "--font-geist-sans"` and `variable: "--font-geist-mono"`.)

```ts
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

export const fontSans = GeistSans;
export const fontMono = GeistMono;

/** Apply on <html> to expose --font-geist-sans and --font-geist-mono. */
export const fontVariables = `${GeistSans.variable} ${GeistMono.variable}`;
```

### 2.3 Theme Provider — `components/theme-provider.tsx`

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
```

### 2.4 Root Layout — `app/layout.tsx`

```tsx
import type { Metadata } from "next";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { fontVariables } from "@/lib/fonts";

import "./globals.css";

export const metadata: Metadata = {
  title: "My App",
  description: "Built with the earthy editorial design system.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Set `lang` to match the project's content language (e.g. "en" or "fr").
    <html lang="en" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

### 2.5 Global Stylesheet — `app/globals.css`

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* Brand primitives */
:root {
  --brand-slate: oklch(0.401 0.042 224.6); /* #2E4D59 */
  --brand-gray: oklch(0.634 0.005 214.3); /* #878B8C */
  --brand-brown: oklch(0.308 0.039 49.4); /* #402A1E */
  --brand-wine: oklch(0.293 0.118 28.8); /* #590202 */
  --brand-ink: oklch(0.1 0.041 29.2); /* #0D0000 */
  --brand-cream: oklch(0.98 0.003 67.8); /* #FAF8F6 */
}

/* Semantic tokens — light (default) */
:root {
  --radius: 0.75rem;

  --background: var(--brand-cream);
  --foreground: var(--brand-ink);

  --card: oklch(1 0 0);
  --card-foreground: var(--brand-ink);

  --popover: oklch(1 0 0);
  --popover-foreground: var(--brand-ink);

  --primary: var(--brand-slate);
  --primary-foreground: var(--brand-cream);

  --secondary: oklch(0.94 0.003 84.6);
  --secondary-foreground: var(--brand-ink);

  --muted: oklch(0.953 0.005 78.3);
  --muted-foreground: oklch(0.535 0.005 214.3);

  --accent: oklch(0.941 0.01 58.2);
  --accent-foreground: var(--brand-brown);

  --destructive: var(--brand-wine);
  --destructive-foreground: var(--brand-cream);

  --border: oklch(0.909 0.007 67.7);
  --input: oklch(0.909 0.007 67.7);
  --ring: var(--brand-slate);

  --success: oklch(0.486 0.068 156.1);
  --success-foreground: var(--brand-cream);
  --warning: oklch(0.527 0.102 72.1);
  --warning-foreground: var(--brand-cream);
  --info: var(--brand-slate);
  --info-foreground: var(--brand-cream);

  --chart-1: var(--brand-slate);
  --chart-2: var(--brand-brown);
  --chart-3: var(--brand-wine);
  --chart-4: var(--brand-gray);
  --chart-5: oklch(0.527 0.102 72.1);

  --sidebar: oklch(0.96 0.005 67.8);
  --sidebar-foreground: var(--brand-ink);
  --sidebar-primary: var(--brand-slate);
  --sidebar-primary-foreground: var(--brand-cream);
  --sidebar-accent: oklch(0.941 0.01 58.2);
  --sidebar-accent-foreground: var(--brand-brown);
  --sidebar-border: oklch(0.909 0.007 67.7);
  --sidebar-ring: var(--brand-slate);

  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 320ms;
}

/* Semantic tokens — dark */
.dark {
  --background: var(--brand-ink);
  --foreground: var(--brand-cream);

  --card: oklch(0.196 0.012 18.2);
  --card-foreground: var(--brand-cream);

  --popover: oklch(0.196 0.012 18.2);
  --popover-foreground: var(--brand-cream);

  --primary: oklch(0.694 0.044 223.7); /* #7FA3B1 */
  --primary-foreground: var(--brand-ink);

  --secondary: oklch(0.252 0.011 17.9);
  --secondary-foreground: var(--brand-cream);

  --muted: oklch(0.252 0.011 17.9);
  --muted-foreground: oklch(0.733 0.004 219.5);

  --accent: oklch(0.27 0.018 48);
  --accent-foreground: oklch(0.925 0.016 58.6);

  --destructive: oklch(0.503 0.143 23.8);
  --destructive-foreground: var(--brand-cream);

  --border: oklch(0.265 0.012 17.9);
  --input: oklch(0.295 0.013 17.9);
  --ring: oklch(0.694 0.044 223.7);

  --success: oklch(0.713 0.071 154.8);
  --success-foreground: var(--brand-ink);
  --warning: oklch(0.756 0.119 78.3);
  --warning-foreground: var(--brand-ink);
  --info: oklch(0.694 0.044 223.7);
  --info-foreground: var(--brand-ink);

  --chart-1: oklch(0.694 0.044 223.7);
  --chart-2: oklch(0.6 0.05 49.4);
  --chart-3: oklch(0.503 0.143 23.8);
  --chart-4: oklch(0.733 0.004 219.5);
  --chart-5: oklch(0.756 0.119 78.3);

  --sidebar: oklch(0.168 0.012 18.4);
  --sidebar-foreground: var(--brand-cream);
  --sidebar-primary: oklch(0.694 0.044 223.7);
  --sidebar-primary-foreground: var(--brand-ink);
  --sidebar-accent: oklch(0.27 0.018 48);
  --sidebar-accent-foreground: oklch(0.925 0.016 58.6);
  --sidebar-border: oklch(0.265 0.012 17.9);
  --sidebar-ring: oklch(0.694 0.044 223.7);
}

/* Expose tokens to Tailwind v4 utilities */
@theme inline {
  --color-brand-slate: var(--brand-slate);
  --color-brand-gray: var(--brand-gray);
  --color-brand-brown: var(--brand-brown);
  --color-brand-wine: var(--brand-wine);
  --color-brand-ink: var(--brand-ink);
  --color-brand-cream: var(--brand-cream);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --radius-xs: calc(var(--radius) - 8px); /* 4px */
  --radius-sm: calc(var(--radius) - 4px); /* 8px */
  --radius-md: calc(var(--radius) - 2px); /* 10px */
  --radius-lg: var(--radius); /* 12px */
  --radius-xl: calc(var(--radius) + 4px); /* 16px */
  --radius-2xl: calc(var(--radius) + 8px); /* 20px */
  --radius-3xl: calc(var(--radius) + 12px); /* 24px */

  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, "SF Mono", monospace;

  --shadow-xs: 0 1px 2px 0 oklch(0.1 0.041 29.2 / 0.04);
  --shadow-sm: 0 1px 3px 0 oklch(0.1 0.041 29.2 / 0.06),
    0 1px 2px -1px oklch(0.1 0.041 29.2 / 0.06);
  --shadow-md: 0 4px 6px -1px oklch(0.1 0.041 29.2 / 0.07),
    0 2px 4px -2px oklch(0.1 0.041 29.2 / 0.07);
  --shadow-lg: 0 10px 15px -3px oklch(0.1 0.041 29.2 / 0.08),
    0 4px 6px -4px oklch(0.1 0.041 29.2 / 0.08);
  --shadow-xl: 0 20px 25px -5px oklch(0.1 0.041 29.2 / 0.1),
    0 8px 10px -6px oklch(0.1 0.041 29.2 / 0.1);

  --ease-soft: cubic-bezier(0.22, 1, 0.36, 1);
}

/* Base layer */
@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    @apply bg-background text-foreground font-sans;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  ::selection {
    @apply bg-primary/20;
  }

  h1 {
    @apply scroll-m-20 text-4xl font-semibold tracking-tight lg:text-5xl;
  }
  h2 {
    @apply scroll-m-20 text-3xl font-semibold tracking-tight;
  }
  h3 {
    @apply scroll-m-20 text-2xl font-semibold tracking-tight;
  }
  h4 {
    @apply scroll-m-20 text-xl font-semibold tracking-tight;
  }
  p {
    @apply leading-7;
  }
  code {
    @apply font-mono text-[0.9em];
  }
}

/* Custom utilities */
@utility container {
  margin-inline: auto;
  padding-inline: 1rem;
  width: 100%;
  max-width: 80rem;

  @media (width >= 40rem) {
    padding-inline: 1.5rem;
  }
  @media (width >= 64rem) {
    padding-inline: 2rem;
  }
}

@utility duration-fast {
  transition-duration: var(--duration-fast);
}

@utility duration-base {
  transition-duration: var(--duration-base);
}

@utility duration-slow {
  transition-duration: var(--duration-slow);
}

@utility text-balance {
  text-wrap: balance;
}

@utility text-pretty {
  text-wrap: pretty;
}

@layer utilities {
  .grain {
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='.23'/%3E%3C/svg%3E");
  }
}
```

---

## 3. Color System & Contrast

### 3.1 Brand Primitives

Raw palette values. Do **not** use `bg-brand-*` or `text-brand-*` in standard product UI; reserve them for always-dark editorial manifesto panels (`bg-brand-ink`, `text-brand-cream`, `bg-brand-slate`, `text-brand-gray`) or illustrations.

| Token | Hex | OKLCH | Role |
|---|---|---|---|
| `brand-slate` | `#2E4D59` | `0.401 0.042 224.6` | Primary, links, focus |
| `brand-gray` | `#878B8C` | `0.634 0.005 214.3` | Decorative borders, dark-panel eyebrows |
| `brand-brown` | `#402A1E` | `0.308 0.039 49.4` | Warm accent foreground |
| `brand-wine` | `#590202` | `0.293 0.118 28.8` | Destructive, errors |
| `brand-ink` | `#0D0000` | `0.1 0.041 29.2` | Text (light) / canvas (dark) / manifesto panel |
| `brand-cream` | `#FAF8F6` | `0.98 0.003 67.8` | Canvas (light) / text (dark) |

### 3.2 Semantic Tokens

Always use semantic tokens for product UI. Values flip automatically between `:root` and `.dark`.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `background` | `#FAF8F6` | `#0D0000` | Page canvas |
| `foreground` | `#0D0000` | `#FAF8F6` | Primary text |
| `card` | `#FFFFFF` | `#1A1313` | Cards, panels, modals |
| `card-foreground` | `#0D0000` | `#FAF8F6` | Text on cards |
| `popover` | `#FFFFFF` | `#1A1313` | Menus, tooltips, popovers |
| `popover-foreground` | `#0D0000` | `#FAF8F6` | Text in popovers |
| `primary` | `#2E4D59` | `#7FA3B1` | Main action, links, focus |
| `primary-foreground` | `#FAF8F6` | `#0D0000` | Text on primary |
| `secondary` | `#ECEBE9` | `#272020` | Secondary action |
| `secondary-foreground` | `#0D0000` | `#FAF8F6` | Text on secondary |
| `muted` | `#F1EFEC` | `#272020` | Subdued surface, image placeholder, skeleton |
| `muted-foreground` | `#6A6E6F` | `#A6A9AA` | Secondary text, labels, placeholders |
| `accent` | `#F1EAE5` | `#2E241F` | Hover/selection surface, warm newsletter band |
| `accent-foreground` | `#402A1E` | `#EFE4DC` | Text on accent |
| `destructive` | `#590202` | `#A63A3A` | Irreversible action, blocking error |
| `destructive-foreground` | `#FAF8F6` | `#FAF8F6` | Text on destructive |
| `border` | `#E4E0DC` | `#2B2323` | Standard borders |
| `input` | `#E4E0DC` | `#332A2A` | Input borders |
| `ring` | `#2E4D59` | `#7FA3B1` | Focus ring |
| `success` / `success-foreground` | `#3D6B4F` / `#FAF8F6` | `#7FB08F` / `#0D0000` | Positive status |
| `warning` / `warning-foreground` | `#8F6019` / `#FAF8F6` | `#D9A650` / `#0D0000` | Warning status |
| `info` / `info-foreground` | `#2E4D59` / `#FAF8F6` | `#7FA3B1` / `#0D0000` | Informational status |
| `sidebar` / `sidebar-foreground` | `#F4F1EE` / `#0D0000` | `#140D0D` / `#FAF8F6` | Sidebar shell |
| `sidebar-primary` / `-foreground` | `#2E4D59` / `#FAF8F6` | `#7FA3B1` / `#0D0000` | Sidebar active item |
| `sidebar-accent` / `-foreground` | `#F1EAE5` / `#402A1E` | `#2E241F` / `#EFE4DC` | Sidebar hover |
| `sidebar-border` / `sidebar-ring` | `#E4E0DC` / `#2E4D59` | `#2B2323` / `#7FA3B1` | Sidebar divider & focus |

Charts use `chart-1` through `chart-5`: slate, brown, wine, neutral gray, amber (lightened in dark mode).

### 3.3 Pairing Rules

| Context | Classes |
|---|---|
| Page canvas | `bg-background text-foreground` |
| Card / panel / modal | `bg-card text-card-foreground` |
| Dropdown / tooltip | `bg-popover text-popover-foreground` |
| Primary action | `bg-primary text-primary-foreground` |
| Secondary action | `bg-secondary text-secondary-foreground` |
| Muted surface | `bg-muted text-muted-foreground` |
| List or row hover / selection | `bg-accent text-accent-foreground` |
| Destructive action | `bg-destructive text-destructive-foreground` |
| Standard border / form field / focus | `border-border` / `border-input` / `ring-ring` |

- Generated shadcn `Button` and `Badge` `destructive` variants use `text-white` instead of `text-destructive-foreground`. Leave those generated files untouched; use `text-destructive-foreground` in your own code.

### 3.4 Contrast Limits & Required Safeguards

Measured text/background WCAG ratios (AA threshold = 4.5:1 for normal text):

| Pairing | Light | Dark |
|---|---|---|
| `foreground` on `background` | 19.5:1 | 19.5:1 |
| `primary-foreground` on `primary` | 8.5:1 | 7.7:1 |
| `primary` as text on `background` | 8.5:1 | 7.7:1 |
| `muted-foreground` on `background` / `card` | 4.9:1 / 5.2:1 | 8.7:1 / 7.8:1 |
| `destructive-foreground` on `destructive` | 13.8:1 | 6.0:1 |

**Critical limits — never violate these:**

1. **`text-muted-foreground` on `bg-accent` or `bg-secondary` fails in light mode (4.33:1)**, and on `bg-muted` is borderline (4.50:1). On `bg-accent` and `bg-secondary` (including hovered table rows), always switch readable text to `text-accent-foreground` or `text-foreground`.
2. **`text-warning` on `bg-warning/15` fails in light mode (4.22:1)**. Use `bg-warning/10 text-warning` (4.52:1). (`bg-success/15 text-success` is 4.72:1 and passes.)
3. **`text-destructive` in dark mode is 3.24:1 on `background` and 2.87:1 on `card`**. Inline error text (`FormMessage`, field errors) must therefore always be accompanied by an icon, be at least `text-base` or `font-medium`, and never serve as the sole error indicator. Solid `bg-destructive text-destructive-foreground` (6.0:1) passes.
4. **`brand-gray` (`#878B8C`) is 3.2:1 on cream**: decorative only in light mode. On `bg-brand-ink` it reaches 6.0:1 and is safe for eyebrows and small labels.

---

## 4. Typography

- **UI & Editorial**: **Geist Sans** (`font-sans`)
- **Code & Tabular Identifiers**: **Geist Mono** (`font-mono`)

### 4.1 Type Scale

Headings `h1`–`h4`, `p`, and `code` are styled automatically in `@layer base` (§2.5). Do not repeat default size, weight, or tracking classes on bare `<h1>`–`<h4>` tags; add classes only when overriding (e.g., a hero `h1`) or styling a non-heading tag.

| Role | Classes | Size | Notes |
|---|---|---|---|
| Display / Hero | `text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl leading-[0.96]` | 48–72px | Hero headline override |
| H1 | `text-4xl font-semibold tracking-tight lg:text-5xl` | 36px / 48px | Default on bare `<h1>` |
| H2 | `text-3xl font-semibold tracking-tight` | 30px | Default on bare `<h2>` |
| H3 | `text-2xl font-semibold tracking-tight` | 24px | Default on bare `<h3>` |
| H4 | `text-xl font-semibold tracking-tight` | 20px | Default on bare `<h4>` |
| Lead | `text-lg text-muted-foreground` | 18px | Introductory copy |
| Body | `text-base leading-7` | 16px / 28px | Default on bare `<p>` |
| Body small | `text-sm` | 14px | Controls, nav, table cells |
| Caption | `text-xs text-muted-foreground` | 12px | Metadata, helper labels |
| Code | `font-mono text-sm` | 14px | Default on `<code>` is `0.9em` |
| Eyebrow | `text-sm font-medium uppercase tracking-[0.18em]` | 14px | Above section titles |
| Eyebrow small | `text-xs font-medium uppercase tracking-[0.18em]` | 12px | Inside cards, image captions, showcase columns |

### 4.2 Typographic Rules

- **Weights**: `font-normal` (400), `font-medium` (500), `font-semibold` (600) only.
- **Tracking**: all headings use `tracking-tight`; body text never uses negative tracking; eyebrows use `tracking-[0.18em]`.
- **Measure & wrapping**: constrain long prose with `max-w-prose` (65ch). Apply `text-balance` to headlines and short blocks; apply `text-pretty` to paragraphs.
- **Numerals**: apply `tabular-nums` to numeric columns, counters, and KPI stats. Keep prices in editorial media cards in Geist Sans (`text-xs font-medium text-muted-foreground`), not mono.

---

## 5. Layout, Spacing & Grid

Built on Tailwind's 4px spacing scale. Avoid arbitrary values (`p-[13px]`).

| Context | Class | Value |
|---|---|---|
| Icon to label | `gap-2` | 8px |
| Between form fields | `gap-4` / `space-y-4` | 16px |
| Card inner padding | `p-6` | 24px |
| Between cards | `gap-6` | 24px |
| Between app page sections | `space-y-12` | 48px |
| App page vertical padding | `py-8 lg:py-12` | 32px / 48px |
| Editorial section vertical rhythm | `py-24 sm:py-32` | 96px / 128px |

- **Container**: always use `container` (max 1280px / `80rem` with responsive `1rem` / `1.5rem` / `2rem` inline padding). Never write `max-w-7xl mx-auto px-4`.
- **Grids**: use CSS Grid (`grid gap-6 sm:grid-cols-2 lg:grid-cols-3`) rather than `flex-wrap` for card collections.
- **Editorial page rhythm**: fixed `h-16` (64px) header → hero `pt-28 sm:pt-32 lg:pt-40` → content sections `py-24 sm:py-32` → footer `py-10 border-t`.

---

## 6. Surfaces, Radius & Elevation

### 6.1 Border Radius (`--radius: 0.75rem` / 12px)

Do not override the built-in radii of generated shadcn components (`Badge` `rounded-full`, `Card` `rounded-xl`, `Dialog` `rounded-lg`, `Checkbox` `4px`). Apply this table to custom elements:

| Element | Class | Value |
|---|---|---|
| Small custom tag / swatch | `rounded-sm` / `rounded-lg` | 8px / 12px |
| Button, input, select | `rounded-md` | 10px |
| Popover, dropdown, dialog | `rounded-lg` | 12px |
| Card, media image, floating info card, table wrapper | `rounded-xl` | 16px |
| Hero image, marketing block, dark manifesto panel | `rounded-2xl` | 20px |
| Badge, avatar, pill, toggle, rating chip | `rounded-full` | 9999px |

### 6.2 Elevation & Shadows

Shadows are tinted with ink (`oklch(0.1 0.041 29.2 / …)`), never pure black.

| Level | Class | Usage |
|---|---|---|
| Level 0 (Rest) | `border` (no shadow) | Custom cards at rest, structural sections |
| Level 1 (Hover / Raised) | `shadow-sm` | Interactive card on hover, dropdown, system showcase card |
| Level 2 (Floating) | `shadow-lg` | Popover, dialog, sheet, toast, floating info card |
| Level 3 (Hero / Modal) | `shadow-xl` | Hero media, dark manifesto panel, full-screen command surface |

- **Clickable shadcn `Card`**: shadcn `Card` ships with `shadow-sm` by default. For an interactive card, reset at rest and lift on hover: `<Card className="cursor-pointer shadow-none transition-shadow duration-fast hover:shadow-sm">`.
- Never combine a heavy border with a heavy shadow.
- In dark mode, elevation is carried primarily by the contrast between `bg-background` and `bg-card`.

---

## 7. Motion & Interaction

| Token / Utility | Value | Usage |
|---|---|---|
| `duration-fast` | `120ms` | Hover, focus, toggle, color transitions |
| `duration-base` | `200ms` | Dropdown, tooltip, state change |
| `duration-slow` | `320ms` | Dialog, sheet, page transition, card image zoom |
| `ease-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | All entrances, exits, and image transforms |

- Add `transition-colors duration-fast` to every clickable text or surface control.
- Do not animate layout dimensions (`width`, `height`), except via `tw-animate-css` inside shadcn primitives.
- Respect reduced motion: pair non-essential transforms with `motion-reduce:transition-none` / `motion-reduce:transform-none`.
- **Signature micro-interactions**: media card image zoom (`transition-transform duration-slow ease-soft group-hover:scale-[1.03]`), brand mark tilt (`group-hover:-rotate-6`), card lift via shadow only (`hover:shadow-sm`).

---

## 8. Component Specifications

Install shadcn primitives via `npx shadcn@latest add <name>`. Do not edit generated files under `components/ui/` except to add a `cva` variant; customize via `className` or CSS tokens.

### 8.1 `Button`
- **Variants**:
  - `default`: primary action — **maximum one per view**.
  - `secondary`: visible alternative action.
  - `outline`: tertiary action, filters, toggles.
  - `ghost`: toolbars, icon buttons, navigation links.
  - `destructive`: irreversible deletion (only inside or after confirmation).
  - `link`: inline navigation.
- **Sizes**: `default` in forms; `sm` in dense tables/cards; `lg` (`h-12 px-6`) in hero CTAs; `icon` for icon-only controls (always pair with `aria-label` and `size-11 sm:size-9` for mobile touch targets). Reserve `xs` / `icon-xs` / `icon-sm` for dense toolbars only.

### 8.2 `Card`
- **Anatomy**: `Card > CardHeader (CardTitle + CardDescription) > CardContent > CardFooter`.
- **Interactive card**: `cursor-pointer shadow-none transition-shadow duration-fast hover:shadow-sm`.
- **Hierarchy**: flat — never nest a `Card` inside another `Card`.

### 8.3 `Input` & `Form`
- Always use shadcn `Input` paired with a `Label` (`htmlFor`). Placeholders never replace labels. Use `className="sr-only"` on `Label` only for compact single-field inline forms (e.g., newsletter band).
- Use shadcn `Form` (`react-hook-form` + `zod`) when a form has more than two fields.
- Help text uses `FormDescription` (`text-muted-foreground`). Error messages use `FormMessage` paired with an icon and `font-medium` (see §3.4 dark mode contrast limit).

### 8.4 `Badge`
- Pill-shaped (`rounded-full`). Variants: `default` (primary emphasis), `secondary` (discreet tag), `outline` (passive filter/hero kicker), `destructive` (blocking/full state).
- **Semantic status badges** (note `/10` on warning per §3.4):
  ```tsx
  <Badge className="bg-success/15 text-success">Available</Badge>
  <Badge className="bg-warning/10 text-warning">Last spot</Badge>
  <Badge variant="destructive">Full</Badge>
  ```

### 8.5 Overlays: `Dialog`, `Sheet`, `Drawer`, `Toaster`
- `Dialog`: confirmations and short forms (maximum 4 fields).
- `Sheet`: long forms, item detail panels, and advanced filters on desktop.
- `Drawer`: mobile bottom-sheet equivalent of `Sheet`.
- `Toaster` (`sonner`): mounted once in `app/layout.tsx`. Success toasts auto-dismiss; error toasts persist and offer a recovery action. Never use a toast for critical blocking errors (use `Dialog` or `Alert`).

### 8.6 `Sidebar`, `Separator`, `ThemeToggle`
- `Sidebar`: shadcn `Sidebar` reading `--sidebar-*` tokens.
- `Separator`: 1px `bg-border` line used to divide dense content groups, never as mere decoration.
- `ThemeToggle`: `variant="ghost" size="icon"` button swapping `Sun` / `Moon` based on `resolvedTheme`, with `className="size-11 sm:size-9"` and a descriptive `aria-label`.

---

## 9. Signature Compositions & Screen Patterns

Use §9.1–§9.7 for landing, marketing, and editorial screens. Use §9.8 for application screens (dashboards, lists, settings, forms).

### 9.1 Translucent Fixed Header
```tsx
<header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
  <div className="container flex h-16 items-center justify-between">
    {/* Brand mark: size-9 rounded-full bg-primary text-primary-foreground with size-4 icon + lowercase wordmark text-lg font-semibold tracking-tight */}
    {/* Nav links: text-sm font-medium transition-colors duration-fast hover:text-primary */}
  </div>
</header>
```

### 9.2 Editorial Hero
- **Ambient backdrop (optional)**: `pointer-events-none absolute -left-40 top-24 size-[30rem] rounded-full bg-accent blur-3xl`.
- **Eyebrow badge**: `<Badge variant="outline" className="gap-2 bg-background/70 px-3 py-1.5 backdrop-blur">` with a small icon in `text-warning`.
- **Headline**: `<h1 className="max-w-2xl text-balance text-5xl leading-[0.96] sm:text-6xl lg:text-7xl">`.
- **Lead**: `<p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">`.
- **CTA row**: `mt-8 flex flex-col gap-3 sm:flex-row` — one primary `<Button size="lg" className="h-12 px-6">` + one `<Button variant="outline" size="lg" className="h-12 px-6">`.
- **Stat row**: `mt-12 grid max-w-lg grid-cols-3 gap-6 border-t pt-6`; values in `text-2xl font-semibold tabular-nums`, labels in `text-xs text-muted-foreground`.
- **Hero media**: `aspect-[4/5]` container with `rounded-2xl shadow-xl overflow-hidden relative`, optional rotated backing (`grain pointer-events-none absolute -inset-4 rotate-3 rounded-3xl bg-accent opacity-50`), bottom-up gradient (`bg-gradient-to-t from-brand-ink/70 via-transparent to-transparent`), caption in `text-brand-cream` (eyebrow `text-xs font-medium uppercase tracking-[0.18em] text-brand-cream/70`, title `text-2xl font-semibold tracking-tight`), and optional offset floating info card (`rounded-xl border bg-card p-4 shadow-lg`).

### 9.3 Editorial Media Card Grid
- **Section header**: eyebrow in `text-primary`, `h2` with `max-w-xl text-balance`, ghost link button aligned right.
- **Grid**: `mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3` (optional middle-column offset `lg:translate-y-10`).
- **Media frame**: `relative aspect-[4/5] overflow-hidden rounded-xl bg-muted`; image uses `object-cover transition-transform duration-slow ease-soft group-hover:scale-[1.03]`.
- **Floating rating chip**: `absolute right-4 top-4 flex items-center gap-1 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur` with star icon in `fill-warning text-warning`.
- **Meta row**: title `text-xl transition-colors duration-fast group-hover:text-primary`, location with `MapPin` (`size-3.5`) in `text-sm text-muted-foreground`, price right-aligned in `text-xs font-medium text-muted-foreground` (Geist Sans).

### 9.4 Dark Manifesto Panel
- **Surface**: `relative overflow-hidden rounded-2xl bg-brand-ink px-6 py-16 text-brand-cream shadow-xl dark:border dark:border-border sm:px-12 lg:px-20 lg:py-24`.
- **Texture & geometry**: `.grain` overlay at `opacity-15`; optional concentric circles (`absolute size-80 rounded-full border border-brand-gray/20`).
- **Typography**: eyebrow in `text-sm font-medium uppercase tracking-[0.18em] text-brand-gray`; decorative Lucide icon `size-8 text-brand-gray` (`strokeWidth={1.5}`); statement in `text-4xl leading-tight text-brand-cream sm:text-5xl`; body copy in `text-brand-cream/70`.
- **Checklist**: `space-y-4 text-sm`, each item paired with a `size-6 rounded-full bg-brand-slate` badge (fixed `bg-brand-slate`, not `bg-primary`, since the panel remains dark in both themes) and `size-3.5` check icon.

### 9.5 System Showcase Card
- **Surface**: `rounded-2xl border bg-card p-6 shadow-sm sm:p-8`.
- **Swatches**: `grid grid-cols-5 gap-2 sm:gap-3`, each swatch `aspect-square rounded-lg`, name `text-xs font-medium`, hex `font-mono text-xs text-muted-foreground`.
- **Lower split**: `<Separator className="my-8" />` followed by `grid gap-8 sm:grid-cols-2` with small eyebrows (`text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground`), type specimen (`text-3xl font-semibold tracking-tight`), and button/badge specimens.

### 9.6 Warm Newsletter Band
- **Surface**: `rounded-2xl bg-accent px-6 py-14 text-center sm:px-12 sm:py-20`.
- **Copy**: eyebrow `text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground/70`; centered `h2` (`mx-auto mt-4 max-w-2xl text-balance`); supporting copy (`mx-auto mt-4 max-w-xl text-pretty text-accent-foreground/70`); fine print below form in solid `text-xs text-accent-foreground` (no opacity).
- **Form**: `mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row` with `<Label htmlFor="email" className="sr-only">`, `<Input id="email" className="h-11 bg-background" />`, and `<Button type="submit" className="h-11">`.

### 9.7 Grain Texture
```tsx
<div aria-hidden="true" className="grain pointer-events-none absolute inset-0 opacity-15" />
```

### 9.8 Application Screens (Dashboards, Lists, Tables, Forms)
- **Shell**: shadcn `Sidebar` or translucent header (§9.1); main content inside `container py-8 lg:py-12 space-y-12`.
- **Page header**: small eyebrow (`text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground`), bare `<h1>`, optional lead (`text-lg text-muted-foreground`), and at most one primary `Button` right-aligned from `sm` upward.
- **Metric cards**: `Card` in a `grid gap-6 sm:grid-cols-2 lg:grid-cols-4`; figure in `text-2xl font-semibold tabular-nums`, label in `text-xs text-muted-foreground`.
- **Tables**: wrapped in `rounded-xl border bg-card`; header cells `text-xs font-medium text-muted-foreground` directly on `bg-card` (not `bg-muted`); numeric columns right-aligned with `tabular-nums`; row hover `hover:bg-accent hover:text-accent-foreground` (ensure all readable cells inside hovered rows switch away from `text-muted-foreground`, per §3.4).
- **Forms**: single column `max-w-xl space-y-4`, `Label` + `Input` + optional `FormDescription`, single primary submit button at the bottom.
- **Empty states**: centered container, `size-6 text-muted-foreground` Lucide icon, bare `<h3>`, one calm sentence in `text-muted-foreground`, and a single CTA button.

---

## 10. Copywriting, Tone & Formatting

- **Editorial & calm voice**: short, concrete, human sentences. Zero hype, zero marketing clichés, **no exclamation marks** anywhere in UI copy or empty states.
- **Eyebrow kickers**: concise 1–3 word uppercase category labels (`tracking-[0.18em]`) placed above headings to anchor context.
- **Action labels**: clear verb phrases stating the outcome (`Reserve stay`, `Save changes`, `Export report`).
- **Numbers & prices**: apply `tabular-nums` on all metrics, dates, and table figures. Format currencies and dates consistently with `Intl` for the active locale.

---

## 11. Iconography & Imagery

- **Icon library**: `lucide-react` exclusively (never emojis).
- **Sizes & stroke**: `size-4` (16px) inside buttons and inline text; `size-5` (20px) in navigation; `size-6` (24px) in empty states and feature callouts; `size-8` with `strokeWidth={1.5}` for decorative editorial icons. Default `strokeWidth={2}`.
- **Accessibility**: add `aria-hidden="true"` to decorative icons; add `aria-label` to icon-only buttons.
- **Photography**: natural landscapes, timber, stone, architecture, and soft daylight in warm, slightly desaturated earth tones. Avoid corporate stock poses, neon lighting, or synthetic gradients. Always render with `next/image`, `object-cover`, and `rounded-xl` or `rounded-2xl`.

---

## 12. Accessibility

- **Focus ring**: preserve shadcn's default `focus-visible:ring-[3px] focus-visible:ring-ring/50`. Never strip focus outlines without an accessible replacement. Do not add `ring-offset-*` in custom code.
- **Touch targets**: minimum `44×44px` on mobile. Use `className="size-11 sm:size-9"` on icon-only buttons so they meet 44px on mobile and settle to 36px from `sm` upward.
- **Semantics & headings**: strict hierarchical heading order (`h1` → `h2` → `h3`), exactly one `<h1>` per view, descriptive `alt` text on informative images (`alt=""` on decorative images).
- **Color independence**: never rely on color alone to convey status or validation errors; always pair with an icon (`Check`, `AlertCircle`) or explicit text label.
- **Contrast**: enforce ≥ 4.5:1 for normal text and ≥ 3:1 for large text across both light and dark themes, strictly respecting the four exceptions documented in §3.4.

---

## 13. Anti-Patterns

| Do Not | Do Instead |
|---|---|
| `bg-blue-500`, `text-gray-400`, `#2E4D59`, raw RGB/OKLCH in JSX | Use semantic tokens (`bg-primary`, `text-muted-foreground`) |
| `text-foreground/50` or arbitrary text opacity | Use `text-muted-foreground` (or `/70` only in the two exceptions in §1) |
| Manual `dark:bg-zinc-900` or `dark:text-*` in components | Let semantic tokens switch automatically via `.dark` |
| `font-bold` or `font-light` | Use `font-semibold` (600), `font-medium` (500), or `font-normal` (400) |
| Bare `rounded` (4px) or `rounded-none` on controls/cards | Use `rounded-md` (controls), `rounded-lg` (overlays), `rounded-xl` (cards) |
| `text-muted-foreground` on `bg-accent` or `bg-secondary` | Use `text-accent-foreground` or `text-secondary-foreground` |
| `bg-warning/15 text-warning` | Use `bg-warning/10 text-warning` (passes 4.5:1 in light mode) |
| `text-destructive` alone for inline errors in dark mode | Pair with an error icon and at least `font-medium` |
| Raw `<input>` or custom focus ring overrides | Use shadcn `<Input />` and `<Label />` |
| Redundant base classes on bare `<h1>`–`<h4>` | Use bare `<h1>`–`<h4>` tags unless overriding for a hero |
| `shadow-2xl`, `shadow-black/50`, or permanent card shadows | Border at rest, ink-tinted `shadow-sm` on hover, `shadow-lg` on overlays |
| `max-w-7xl mx-auto px-4` | Use the `container` utility |
| Editing `components/ui/*.tsx` to tweak colors or radii | Override via `app/globals.css` tokens or `className` |
| Two `default` (primary) buttons in the same view | One `default` button + `secondary`, `outline`, or `ghost` |
| Nesting a `Card` inside another `Card` | Keep a flat surface hierarchy |

---

## 14. Agent Verification Checklist

- [ ] **Foundation files**: `components.json`, `lib/fonts.ts`, `components/theme-provider.tsx`, `app/layout.tsx` (with `<Toaster />`), and `app/globals.css` match §2 verbatim.
- [ ] **Zero raw colors**: no Tailwind palette utilities (`slate-*`, `zinc-*`, `gray-*`), hex codes, or manual `dark:` overrides in product components.
- [ ] **Canvas polarity**: light mode renders warm cream (`#FAF8F6`) and dark mode renders warm ink (`#0D0000`), never `#FFFFFF` or `#000000` as the page background.
- [ ] **Typography discipline**: only weights 400 / 500 / 600 used; bare `h1`–`h4` rely on `@layer base`; eyebrows use `uppercase tracking-[0.18em]`; numeric columns and stats use `tabular-nums`.
- [ ] **Layout & spacing**: all page sections use `container`; cards use `p-6`; grids use `gap-6`; editorial sections use `py-24 sm:py-32` and app views use `py-8 lg:py-12 space-y-12`.
- [ ] **Radius & elevation**: controls `rounded-md`, dialogs `rounded-lg`, cards/media `rounded-xl`, hero/manifesto panels `rounded-2xl`, pills `rounded-full`; custom cards have borders at rest and ink-tinted `shadow-sm` on hover.
- [ ] **Action hierarchy**: at most one primary (`variant="default"`) button per screen.
- [ ] **Contrast safeguards (§3.4)**: no `text-muted-foreground` on `bg-accent` or `bg-secondary`; warning badges use `bg-warning/10 text-warning`; inline errors include an icon and `font-medium`; dark manifesto panels include `dark:border dark:border-border`.
- [ ] **Accessibility & motion**: icon-only buttons have `aria-label` and `size-11 sm:size-9`; interactive elements have `transition-colors duration-fast`; reduced motion is respected.
