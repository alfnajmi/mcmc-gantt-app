# @mcmc/gantt-chart SDK

Embeddable Gantt chart component for any web application. No iframe needed — renders directly in your page's DOM.

## Three ways to use

### 1. Web Component (any framework or plain HTML)

```html
<mcmc-gantt
  project="my-project"
  api="https://gantt.mcmc.gov.my"
  editable
  height="80vh"
></mcmc-gantt>

<script src="https://gantt.mcmc.gov.my/sdk/gantt-element.js" type="module"></script>
```

Attributes:
| Attribute | Required | Description |
|-----------|----------|-------------|
| `project` | Yes | Project slug |
| `api` | No | API base URL (default: same origin) |
| `editable` | No | Presence enables editing |
| `scale` | No | day, week, or month (default: month) |
| `height` | No | Container height (default: 600px) |

Events:
| Event | Detail |
|-------|--------|
| `task-click` | Task object |
| `task-change` | Updated task object |

### 2. Vue 3 Component

```bash
npm install @mcmc/gantt-chart
```

```vue
<script setup>
import { GanttChart } from '@mcmc/gantt-chart/vue'

function handleClick(task) {
  console.log('Clicked:', task.text)
}
</script>

<template>
  <GanttChart
    project="my-project"
    api-base="https://gantt.mcmc.gov.my"
    :editable="true"
    scale="month"
    height="80vh"
    @task-click="handleClick"
  />
</template>
```

Props:
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `project` | String | — | Project slug (required) |
| `apiBase` | String | `''` | API base URL |
| `editable` | Boolean | `false` | Allow editing |
| `scale` | String | `'month'` | Zoom level |
| `height` | String | `'600px'` | Container height |

### 3. Imperative JS API

```js
import { mountGantt } from '@mcmc/gantt-chart'

const gantt = mountGantt({
  container: document.getElementById('my-gantt'),
  project: 'my-project',
  apiBase: 'https://gantt.mcmc.gov.my',
  editable: true,
  scale: 'month',
  onTaskClick: (task) => console.log(task),
  onTaskChange: (task) => console.log('updated', task),
})

// Later:
gantt.setScale('week')
gantt.destroy()
```

## Building

```bash
cd sdk
npm install
npm run build
# Output in dist/
```

## Hosting the SDK

After building, serve the `dist/` folder from the Gantt platform:

```
https://gantt.mcmc.gov.my/sdk/gantt-element.js   ← Web Component
https://gantt.mcmc.gov.my/sdk/gantt-chart.es.js  ← ES module
```

Or publish to your private npm registry:
```bash
npm publish --registry https://npm.mcmc.gov.my
```

## How it works

```
Your Portal                        Gantt Platform API
┌──────────────────────┐           ┌───────────────────────┐
│                      │           │                       │
│  <mcmc-gantt />      │──fetch───▶│  /api/projects/:slug  │
│  or <GanttChart />   │           │  /data, /task, /link  │
│  or mountGantt()     │◀──json────│                       │
│                      │           │                       │
│  Renders DHTMLX in   │           └───────────────────────┘
│  YOUR page's DOM     │
│  (no iframe)         │
└──────────────────────┘
```
