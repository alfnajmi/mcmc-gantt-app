# @mcmc/gantt-chart SDK

Embeddable Gantt chart component for any web application. No iframe needed — renders directly in your page's DOM.

Published to GitHub Packages at `https://devgithub.mcmc.gov.my/_registry/npm/`.

## Installation

Add a `.npmrc` to your project to scope `@mcmc` packages to the private registry:

```
@mcmc:registry=https://devgithub.mcmc.gov.my/_registry/npm/
//devgithub.mcmc.gov.my/_registry/npm/:_authToken=${NPM_TOKEN}
```

Then install:

```bash
npm install @mcmc/gantt-chart
```

For Docker builds, pass the token as a build arg:

```dockerfile
ARG NPM_TOKEN
RUN npm install
```

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

```vue
<script setup>
import GanttChart from '@mcmc/gantt-chart/vue'

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

> Note: The Vue wrapper is a default export — use `import GanttChart from '@mcmc/gantt-chart/vue'` (no curly braces).

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

## Building locally

```bash
cd sdk
npm install
npm run build
# Output in dist/
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
