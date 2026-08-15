<script setup>
/**
 * <GanttChart> — Vue 3 wrapper around the core Gantt engine.
 *
 * Usage:
 *   <GanttChart project="persada" :editable="true" plane-url="https://plane.example.com" />
 *
 * Props:
 *   project        — project slug or UUID (required)
 *   apiBase        — API base URL (default: '')
 *   editable       — allow editing (default: false)
 *   scale          — initial zoom: day|week|month|year (default: month)
 *   height         — container height (default: '600px')
 *   planeUrl       — Plane instance URL (enables "View in Plane" popup button)
 *   workspaceSlug  — Plane workspace slug
 *   projectId      — Plane project UUID (for Plane links)
 *   showPopup      — show task detail popup on bar click (default: true)
 *
 * Events:
 *   task-click  — emitted with task object when a task bar is clicked
 *   task-change — emitted with task object after update (drag/resize)
 */

import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { mountGantt } from './core.js'

const props = defineProps({
  project: { type: String, required: true },
  apiBase: { type: String, default: '' },
  editable: { type: Boolean, default: false },
  scale: { type: String, default: 'month' },
  height: { type: String, default: '600px' },
  planeUrl: { type: String, default: '' },
  workspaceSlug: { type: String, default: '' },
  projectId: { type: String, default: '' },
  showPopup: { type: Boolean, default: true },
})

const emit = defineEmits(['task-click', 'task-change'])

const containerRef = ref(null)
let controller = null

onMounted(() => {
  initGantt()
})

onBeforeUnmount(() => {
  if (controller) {
    controller.destroy()
    controller = null
  }
})

watch(() => props.scale, (newScale) => {
  if (controller) controller.setScale(newScale)
})

watch(() => props.project, () => {
  if (controller) controller.destroy()
  initGantt()
})

function initGantt() {
  if (!containerRef.value) return

  controller = mountGantt({
    container: containerRef.value,
    project: props.project,
    apiBase: props.apiBase,
    editable: props.editable,
    scale: props.scale,
    planeUrl: props.planeUrl,
    workspaceSlug: props.workspaceSlug,
    projectId: props.projectId,
    showPopup: props.showPopup,
    onTaskClick: (task) => emit('task-click', task),
    onTaskChange: (task) => emit('task-change', task),
  })
}
</script>

<template>
  <div ref="containerRef" class="gantt-container" :style="{ height }"></div>
</template>

<style scoped>
.gantt-container {
  width: 100%;
  position: relative;
}
</style>
