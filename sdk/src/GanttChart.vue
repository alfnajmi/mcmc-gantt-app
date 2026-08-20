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
 *   showGrid       — show the task table beside the timeline (default: true)
 *   showZoomControls — show floating timeline zoom controls (default: false)
 *   scaleHeight    — total timeline-header height (default: 64px)
 *
 * Events:
 *   task-click  — emitted with task object when a task bar is clicked
 *   task-change — emitted with task object after update (drag/resize)
 *   scale-change — emitted with day|week|month|year after a zoom button is clicked
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
  showGrid: { type: Boolean, default: true },
  showZoomControls: { type: Boolean, default: false },
  scaleHeight: { type: Number, default: 64 },
})

const emit = defineEmits(['task-click', 'task-change', 'scale-change'])

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

watch(() => props.showGrid, (visible) => {
  if (controller) controller.setGridVisible(visible)
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
    showGrid: props.showGrid,
    showZoomControls: props.showZoomControls,
    scaleHeight: props.scaleHeight,
    onTaskClick: (task) => emit('task-click', task),
    onTaskChange: (task) => emit('task-change', task),
    onScaleChange: (level) => emit('scale-change', level),
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
