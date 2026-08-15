# @mcmc/gantt-chart SDK

Embeddable Gantt chart component for any web application. No iframe needed — renders directly in your page's DOM.

Published to GitHub Packages at `https://devgithub.mcmc.gov.my/_registry/npm/`.

## Features (v1.1.0)

- Task detail popup on bar click (Task/Project badge, status, dates, assignee, duration)
- "View in Plane" button in popup (links directly to issue/module in Plane)
- Status-based bar coloring (complete → green, in progress → blue, planning → purple, to do → gray)
- Weekend diagonal striping on day-level scales
- Today line (dashed pink) + scale header highlight
- Row drag-to-reorder with Plane sync
- Project-type bars for modules/cycles (thin green group bars)
- Milestone markers
- Editable mode (drag to resize/move bars, DataProcessor syncs to API)

## Installation

Add `.npmrc` to scope `@mcmc` packages to the private registry:

```
@mcmc:registry=https://devgithub.mcmc.gov.my/_registry/npm/
//devgithub.mcmc.gov.my/_registry/npm/:_authToken=${NPM_TOKEN}
```

Then install:

```bash
npm install @mcmc/gantt-chart
```

## Three ways to use

### 1. Web Component (any framework or plain HTML)

```html
<mcmc-gantt
  project="persada"
  api="https://gantt.mcmc.gov.my"
  plane-url="https://plane-digd.mcmc.gov.my"
  workspace-slug="disd"
  project-id="48b5e204-6a3d-46bf-84ec-fb603cf8dd35"
  editable
  height="80vh"
></mcmc-gantt>

<script src="https://gantt.mcmc.gov.my/sdk/gantt-element.js" type="module"></script>
```

### 2. Vue 3 Component

```vue
<script setup>
import GanttChart from '@mcmc/gantt-chart/vue'
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
    height="80vh"
    @task-click="handleClick"
    @task-change="handleChange"
  />
</template>
```

### 3. Imperative JS API

```js
import { mountGantt } from '@mcmc/gantt-chart'

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

  // Callbacks
  onTaskClick: (task) => console.log(task),
  onTaskChange: (task) => console.log('updated', task),
})

// Later:
gantt.setScale('week')
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
| `onTaskClick` | function | `null` | Callback when task bar is clicked |
| `onTaskChange` | function | `null` | Callback after task is updated (drag/resize) |

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

```bash
cd sdk
# 1. Bump version in package.json
# 2. Build and publish (prepublishOnly runs build automatically)
npm publish
```

Ensure you've authenticated:

```bash
npm config set //devgithub.mcmc.gov.my/_registry/npm/:_authToken <YOUR_GITHUB_TOKEN>
```

The token needs `write:packages` scope.

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
