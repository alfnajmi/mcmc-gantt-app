<script setup>
/**
 * <GanttChart> — Vue 3 wrapper around the core Gantt engine.
 *
 * Usage:
 *   <GanttChart project="persada-phase-1" :editable="true" @task-click="handle" />
 *
 * Props:
 *   project  — project slug (required)
 *   apiBase  — API base URL (default: '')
 *   editable — allow editing (default: false)
 *   scale    — initial zoom: day|week|month (default: month)
 *   height   — container height (default: '600px')
 *
 * Events:
 *   task-click  — emitted with task object when a task is clicked
 *   task-change — emitted with task object after update
 */

import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { mountGantt } from './core.js'

const props = defineProps({
  project: { type: String, required: true },
  apiBase: { type: String, default: '' },
  editable: { type: Boolean, default: false },
  scale: { type: String, default: 'month' },
  height: { type: String, default: '600px' },
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
:deep(.gantt-today-cell) {
  background: rgba(229, 57, 53, 0.08);
  border-left: 2px solid #e53935;
}
</style>
