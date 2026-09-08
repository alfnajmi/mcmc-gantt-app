# @alfnajmi/gantt-chart SDK

Embeddable Gantt chart component for any web application. No iframe needed — renders directly in your page's DOM.

Published to GitHub Packages as [`@alfnajmi/gantt-chart`](https://github.com/alfnajmi/mcmc-gantt-app/packages). Installing requires a GitHub token with `read:packages`; see the install section below.

> Documentation last reviewed: 7 September 2026
>
> This document is the integration source of truth for SDK consumers.

## Features (v1.4.9)

- Task detail popup on bar click (Task/Project badge, status, dates, assignee, duration)
- "View in Plane" button in popup (links directly to issue/module in Plane)
- Pastel status-based bar coloring (complete → mint, in progress → blue, planning → lavender, to do → slate)
- Weekend diagonal striping on day-level scales
- Plane-style current-time line (solid red with a circular cap) + scale header highlight
- Row drag-to-reorder with Plane sync
- Project-type bars for modules/cycles (thin green group bars)
- Milestone markers
- Projects are native Plane Modules; Tasks and Milestones are Plane work items
- Promote a Task into a standalone Module while preserving its direct subtasks
- Recoverable deletion for Projects, Tasks, and Milestones with a 10-second Undo action
- Trash drawer with Restore, Delete forever, and automatic 30-day cleanup
- Adaptive task labels: outside-right when possible, inside long bars or outside-left near viewport edges
- Floating zoom-in/zoom-out controls for day, week, month, and year scales
- Roomier two-band timeline headers (64px by default, configurable)
- Timeline grid and weekend shading continue below the final task
- Subtle row separators in the task table without lines across the timeline
- Collapsible task table with remembered visibility
- Editable mode (drag to resize/move bars, DataProcessor syncs to API)

## Data model and compatibility

The SDK follows Plane semantics:

| SDK type | Plane entity | Behaviour |
|----------|--------------|-----------|
| `project` | Module | Standalone group that can own tasks |
| `task` | Work item | May have the same start and due date |
| `milestone` | Work item | Explicit persisted type rendered as a diamond |

Do not infer milestones from date equality. Consumers must preserve the `type`/`gantt_type` supplied by the API; a one-day task and a milestone can both have equal dates.

For the full management experience—including task-to-module promotion, the protected three-dot delete action, Undo, and the 30-day Trash drawer—use `GanttView`. The bare renderer exposes chart controls but does not add the full toolbar and management panels.

## Quick start (for portal teams)

You don't need to set up a backend or manage environment variables. The Gantt API is already deployed and connected to Plane. Just install the SDK and point to it:

```vue
<script setup>
import GanttView from '@alfnajmi/gantt-chart/view'
</script>

<template>
  <GanttView
    project="persada"
    api-base="https://gantt.mcmc.gov.my"
    plane-url="https://plane-digd.mcmc.gov.my"
    workspace-slug="disd"
    :show-project-selector="true"
    :editable="true"
    height="80vh"
  />
</template>
```

That's it. No `.env` files, no backend setup, no database. The component handles everything.

**What you need from the DISD team:**
| Info | Example | Who provides it |
|------|---------|-----------------|
| Gantt API URL | `https://gantt.mcmc.gov.my` | DISD infra team |
| Plane URL | `https://plane-digd.mcmc.gov.my` | DISD infra team |
| Workspace slug | `disd` | Look at your Plane URL |
| Project ID | UUID from Plane | Or use identifier like `persada` |

## Installation

The package is hosted on GitHub Packages, so consumers must route the `@alfnajmi`
scope to the GitHub npm registry and authenticate with a token that has
`read:packages`. Add an `.npmrc` to the consuming project:

```ini
@alfnajmi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${CLOUD_NPM_TOKEN}
```

Then install:

```bash
npm install @alfnajmi/gantt-chart
```

## Three ways to use

### Recommended: GanttView (full experience)

```vue
<script setup>
import GanttView from '@alfnajmi/gantt-chart/view'
</script>

<template>
  <GanttView
    project="persada"
    api-base="https://gantt.mcmc.gov.my"
    plane-url="https://plane-digd.mcmc.gov.my"
    workspace-slug="disd"
    :show-project-selector="true"
    :editable="true"
    height="80vh"
  />
</template>
```

Includes toolbar, filter, fields panel, edit sidebar, and task popup — zero additional code.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `project` | string | — | Project UUID or identifier |
| `apiBase` | string | — | Gantt API base URL |
| `editable` | boolean | `true` | Allow editing |
| `scale` | string | `'week'` | Initial zoom |
| `height` | string | `'100%'` | Container height |
| `planeUrl` | string | `''` | Plane URL (for "Open in Plane") |
| `workspaceSlug` | string | `''` | Plane workspace slug |
| `projectId` | string | `''` | Plane project UUID |
| `showToolbar` | boolean | `true` | Show/hide toolbar |
| `showFilter` | boolean | `true` | Show/hide filter button |
| `showFields` | boolean | `true` | Show/hide fields button |
| `showProjectSelector` | boolean | `false` | Show project dropdown |
| `showClosed` | boolean | `true` | Initial closed toggle state |
| `showTaskTable` | boolean | `true` | Initial task-table visibility; the toolbar toggle remembers the user's choice |
| `showZoomControls` | boolean | `true` | Show floating zoom-in/zoom-out controls |
| `scaleHeight` | number | `64` | Total height of the timeline scale header |

### Alternative: GanttChart (bare renderer)

For portals that want full control over the toolbar and surrounding UI:

When composing SDK panels around the bare chart, use the SDK sidebar controller so
Fields and Trash remain mutually exclusive:

```vue
<script setup>
import GanttFieldsPanel from '@alfnajmi/gantt-chart/fields-panel'
import { useGanttSidebars } from '@alfnajmi/gantt-chart/sidebars'

const {
  fieldsOpen,
  trashOpen,
  openFields,
  closeFields,
  openTrash,
  closeTrash,
} = useGanttSidebars()
</script>
```

Opening either sidebar automatically closes the other. `GanttView` uses this same
controller internally, making the SDK the source of truth for sidebar behavior.

### 1. Web Component (any framework or plain HTML)

```html
<mcmc-gantt
  project="persada"
  api="https://gantt.mcmc.gov.my"
  plane-url="https://plane-digd.mcmc.gov.my"
  workspace-slug="disd"
  project-id="48b5e204-6a3d-46bf-84ec-fb603cf8dd35"
  editable
  show-grid="true"
  show-zoom-controls="true"
  scale-height="64"
  height="80vh"
></mcmc-gantt>

<script src="https://gantt.mcmc.gov.my/sdk/gantt-element.js" type="module"></script>
```

### 2. Vue 3 Component

```vue
<script setup>
import GanttChart from '@alfnajmi/gantt-chart/vue'
</script>

<template>
  <GanttChart
    project="persada"
    api-base="https://gantt.mcmc.gov.my"
    plane-url="https://plane-digd.mcmc.gov.my"
    workspace-slug="disd"
    project-id="48b5e204-..."
    :editable="true"
    scale="week"
    :show-zoom-controls="true"
    :scale-height="64"
    height="80vh"
    @scale-change="handleScaleChange"
    @task-click="handleClick"
    @task-change="handleChange"
  />
</template>
```

### 3. Imperative JS API

```js
import { mountGantt } from '@alfnajmi/gantt-chart'

const gantt = mountGantt({
  container: document.getElementById('my-gantt'),
  project: 'persada',
  apiBase: 'https://gantt.mcmc.gov.my',
  editable: true,
  scale: 'week',

  // Plane integration (enables "View in Plane" button in popup)
  planeUrl: 'https://plane-digd.mcmc.gov.my',
  workspaceSlug: 'disd',
  projectId: '48b5e204-6a3d-46bf-84ec-fb603cf8dd35',

  // Popup control
  showPopup: true,  // default: true
  showGrid: true,   // default: true
  showZoomControls: true, // default: false in the bare API
  scaleHeight: 64,

  // Callbacks
  onTaskClick: (task) => console.log(task),
  onTaskChange: (task) => console.log('updated', task),
  onScaleChange: (level) => console.log('scale', level),
})

// Later:
gantt.setScale('week')
gantt.zoomIn()
gantt.zoomOut()
gantt.setGridVisible(false)
gantt.destroy()
```

## Props / Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `project` | string | — | Project UUID or identifier (required) |
| `apiBase` | string | `''` | Gantt API base URL |
| `editable` | boolean | `false` | Allow drag-to-edit (dates sync back to Plane) |
| `scale` | string | `'month'` | Initial zoom: `day`, `week`, `month`, `year` |
| `planeUrl` | string | `''` | Plane instance URL (enables "View in Plane" in popup) |
| `workspaceSlug` | string | `''` | Plane workspace slug |
| `projectId` | string | `''` | Plane project UUID (for building Plane links) |
| `showPopup` | boolean | `true` | Show task detail popup on bar click |
| `showGrid` | boolean | `true` | Show the task table beside the timeline |
| `showZoomControls` | boolean | `false` | Show floating timeline zoom controls |
| `scaleHeight` | number | `64` | Total height of the timeline scale header |
| `onTaskClick` | function | `null` | Callback when task bar is clicked |
| `onTaskChange` | function | `null` | Callback after task is updated (drag/resize) |
| `onScaleChange` | function | `null` | Callback after zoom controls change the scale |

## Task Popup

When you click a task bar in the timeline, a popup appears showing:

- **Badge**: "Task" (blue) or "Project" (purple)
- **Issue ID**: e.g., PERSADA-35
- **Task name**
- **Status, Assignee, Priority** (if available)
- **Start date, Due/Target date, Duration**
- **"View in Plane" button** (opens the issue/module directly in Plane)

The popup only triggers on timeline bar clicks — clicking the grid (task names, expand/collapse arrows) does not open it.

To disable the popup: set `showPopup: false`.

## Built-in Styling

The SDK injects CSS automatically for:

| Visual | Description |
|--------|-------------|
| Status bar colors | `complete` = green, `in progress` = blue, `planning` = purple, `to do` = gray |
| Project bars | Thin green line with project icon |
| Milestones | Gold diamond |
| Weekend cells | Diagonal hatch pattern on Saturday/Sunday columns |
| Today line | Dashed pink border on today's column |
| Today scale | Pink highlighted date in the timeline header |

## Publishing a new version

Publishing is handled by the GitHub.com `Publish SDK` workflow whenever package or SDK changes reach the cloud repository's `staging` branch. Pull requests are validated before merge, and every publishable change must commit a new, previously unpublished version in both `sdk/package.json` and `sdk/package-lock.json`.

For a manual release from an authenticated environment:

```bash
cd sdk
npm ci
npm run build
NODE_AUTH_TOKEN=<github-token> npm publish
```

Use a GitHub token with `write:packages` on the `alfnajmi/mcmc-gantt-app` repo (in CI the built-in `GITHUB_TOKEN` with `packages: write` suffices); never commit the token. The registry and scope are set via the package's `publishConfig`.

## How it works

```
Your Portal                        Gantt API              Plane.so
┌──────────────────────┐           ┌──────────────┐      ┌──────────┐
│                      │           │              │      │          │
│  <mcmc-gantt />      │──fetch───▶│  /api/projects│─────▶│  Issues  │
│  or <GanttChart />   │           │  /data       │      │  Modules │
│  or mountGantt()     │◀──json────│  /reorder    │◀─────│  Cycles  │
│                      │           │              │      │          │
│  Renders DHTMLX +    │           └──────────────┘      └──────────┘
│  popup in YOUR DOM   │
│  (no iframe)         │
└──────────────────────┘
```
