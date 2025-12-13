# Shepherd Design Style Guide v1
_Authoritative visual + interaction specification for Codex implementation_

## 1. Brand Principles

Shepherd should feel:

- **Minimal, fast, modern** — similar to Linear, with slight warmth from Figma.
- **Calm and decisive** — no visual noise, use whitespace with intention.
- **Collaborative, not social** — real-time clarity without flashiness.
- **Opinionated but lightweight** — a guide rail, not a cage.

Use this mindset across all UI decisions.

---

## 2. Visual Foundations

### 2.1 Color System

**Primary Accent**  
- `#3A6F74`  
Used sparingly for actions, focus states, active nav, selected cards, and key indicators.

**Neutrals** (examples)

| Token | Hex |
|-------|------|
| neutral-0 | `#FFFFFF` |
| neutral-50 | `#F8FAFC` |
| neutral-100 | `#F1F5F9` |
| neutral-200 | `#E2E8F0` |
| neutral-300 | `#CBD5E1` |
| neutral-400 | `#94A3B8` |
| neutral-500 | `#64748B` |
| neutral-600 | `#475569` |
| neutral-700 | `#334155` |
| neutral-800 | `#1E293B` |
| neutral-900 | `#0F172A` |

**Semantic Colors**

- Success: `#059669` / `#16A34A`
- Warning: `#D97706`
- Danger:  `#DC2626`
- Info: use primary accent

**Usage Rules**

- Backgrounds: neutral-0/50/100  
- Borders: neutral-200/300  
- Text: neutral-800 primary, 600 secondary, 500 meta  
- Only 1–2 accent surfaces per screen  

---

### 2.2 Typography

**Primary Font Family**

```
Inter, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
```

**Typographic Hierarchy**

- Page title: `text-2xl` / `font-semibold`
- Section title: `text-xl` / `font-semibold`
- Card titles & control labels: `text-base` / `font-medium`
- Body: `text-sm` / `font-normal`
- Meta text / tag labels: `text-xs` or `text-[11px]`

**Rules**

- Favor compact, high-legibility layouts.
- Avoid more than 3 type sizes per surface.

---

### 2.3 Spacing & Density

- Base unit: **4px**
- Desired feel: between **compact** and **medium**

Common patterns:

- Card padding: `p-3` or `p-4`
- Section padding: `p-6` or `p-8`
- Element gaps: `gap-2` / `gap-3`
- Vertical form spacing: `space-y-2` / `space-y-3`

Rule: Never <8px between unrelated elements; never >24px inside application surfaces.

---

### 2.4 Corner Radius

- Default: **6px** (`rounded-md`)
- Larger surfaces: **8px** (`rounded-lg`)
- Pills/tags: **full radius**

Avoid sharp (0–2px) corners.

---

### 2.5 Shadows & Elevation

- Only subtle shadows.
- Most surfaces rely on border + light elevation.

Use:

- Cards: `border border-neutral-200`, **no shadow**
- Modals / drawers: `shadow-sm`
- Drag state (dnd-kit): slight elevation + soft shadow

---

### 2.6 Iconography

- **Lucide** (default with shadcn/ui)
- Sizes:
  - 16px inline  
  - 18–20px nav

Colors:

- Neutral-500 default  
- Primary accent for active state only  

Consistency rule: never mix filled and outline icons in same context.

---

## 3. Interaction & Motion

### 3.1 Motion Principles

- Fast + subtle (Linear-like)
- 150–200ms transitions
- Avoid elastic or bouncy animations

### 3.2 Interaction Patterns

- Hover: neutral-50 background, stronger border, or subtle shadow
- Active: primary border or left accent bar
- Focus: 2px outline in `#3A6F74`, visible + accessible

### 3.3 Real-time Feel

- Prefer optimistic updates (TanStack Query)
- Use skeletons over spinners
- Realtime sync for ideas, clusters, comments, assignments

---

## 4. Layout Architecture

### 4.1 Global Layout

- **Left navigation sidebar** (collapsible)
- **Top bar** for context + actions
- **Main content area** below

Sidebar items:

- Ideation  
- Grouping  
- Roadmap  
- Prioritization  
- Settings  

### 4.2 View Layouts

#### 4.2.1 Ideation View  
**Kanban-style board**

- Horizontal columns for themes or ideation categories  
- Column = header + list of IdeaCards  
- Add-idea button at column bottom  
- IdeaCard = compact card with text, optional link icon, meta line  

#### 4.2.2 Grouping View  
**Cluster board**

- Clusters appear as “group cards” containing ideas  
- Drag idea cards between clusters (dnd-kit)  
- Cluster UI uses light background + border to suggest grouping  

#### 4.2.3 Roadmap View  
**Table/List first, card drill-in second**

- Table columns: Title, Theme, Status, Owner, Score, etc.  
- Row click → right-side panel (card drawer) showing details, linked ideas, RICE/ICE, comments, history  

#### 4.2.4 Prioritization View  
**Task inbox + inspector**

- Left list = items needing user input (@mentions, assigned RICE fields)  
- Right pane = RICE/ICE inspector  
- Inputs use dropdowns + numeric fields with rubric tooltips

---

## 5. Core Components

### 5.1 Buttons

Variants:

- Primary (filled, primary color)  
- Secondary (neutral border)  
- Ghost (transparent, hover bg)  
- Destructive (red)  

Sizes: small, medium only.

### 5.2 Inputs

- Border neutral-200 (hover 300)
- Focus outline in primary
- Label: `text-xs text-neutral-500`

### 5.3 Cards

- Border: neutral-200
- Radius: 6px
- Padding: `p-3` or `p-4`
- Hover: neutral-50 background or stronger border
- Selected: border or ring in primary

### 5.4 Tags / Pills

- Rounded-full  
- `px-2 py-[2px] text-[11px] font-medium`  
- Theme tags: colored dot + neutral pill  
- Status: color-coded (neutral, primary, green, red)

### 5.5 Navigation

Sidebar:

- Active item has left accent bar (primary)
- Hover: neutral-100

Top bar:

- Breadcrumb, project name, filters, actions

### 5.6 Overlays

- Backdrop: neutral-900 @ 60%  
- Panel: white, rounded-lg, `shadow-sm`  

---

## 6. Shepherd-Specific Patterns

### 6.1 Ideas

- Text + optional link  
- Meta: author + relative time  
- Optional indicator: “Linked to N items”

### 6.2 Clusters

- Cluster panel:
  - Name, count  
  - Light background, subtle border  
- Contain IdeaCards

### 6.3 Roadmap Items

Each row shows:

- Title  
- Theme pill  
- Status pill  
- Owner avatar  
- Score  
- # Linked ideas  

### 6.4 RICE/ICE Scoring

Inputs:

- Reach: numeric or auto from pages  
- Impact: rubric-based dropdown  
- Confidence: meter-based dropdown (Itamar Gilad style)  
- Effort: XS–XL presets  

Score formulas:

```
RICE = (Reach × Impact × Confidence) / Effort
ICE  = (Impact × Confidence) / Effort
```

Displayed prominently in roadmap & prioritization.

---

## 7. Accessibility Guidelines

- Contrast ratio ≥ 4.5:1  
- Focus outline always visible  
- Keyboard access for all interactive elements  
- Don’t rely solely on color to convey status  

---

