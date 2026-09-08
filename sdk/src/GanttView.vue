<script setup>
/**
 * <GanttView> — Full-featured Gantt view with toolbar, filters, fields panel.
 *
 * This is the "batteries-included" component. Portals can embed it with zero config
 * and get a complete Gantt experience: toolbar, scale selector, filter dropdown,
 * fields panel, task popup, edit sidebar, and the chart itself.
 *
 * For advanced customization, use <GanttChart> (bare renderer) instead.
 *
 * Props:
 *   project        — project UUID or identifier (required)
 *   apiBase        — Gantt API base URL (required)
 *   editable       — allow drag-to-edit (default: true)
 *   scale          — initial zoom: day|week|month|year (default: week)
 *   height         — container height (default: 100%)
 *   planeUrl       — Plane instance URL (for "Open in Plane")
 *   workspaceSlug  — Plane workspace slug
 *   projectId      — Plane project UUID
 *   showToolbar    — show the toolbar (default: true)
 *   showFilter     — show the filter button (default: true)
 *   showFields     — show the fields button (default: true)
 *   showClosed     — initial state for completed tasks (default: true)
 *   showTaskTable  — initial task-table visibility (default: true)
 *   showZoomControls — show floating timeline zoom controls (default: true)
 *   scaleHeight    — total timeline-header height (default: 64px)
 */

import { ref, reactive, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { mountGantt } from './core.js'
import { useGanttSidebars } from './useGanttSidebars.js'

const props = defineProps({
  project: { type: String, default: '' },
  apiBase: { type: String, required: true },
  editable: { type: Boolean, default: true },
  scale: { type: String, default: 'week' },
  height: { type: String, default: '100%' },
  planeUrl: { type: String, default: '' },
  workspaceSlug: { type: String, default: '' },
  projectId: { type: String, default: '' },
  showToolbar: { type: Boolean, default: true },
  showFilter: { type: Boolean, default: true },
  showFields: { type: Boolean, default: true },
  showClosed: { type: Boolean, default: true },
  showTaskTable: { type: Boolean, default: true },
  showZoomControls: { type: Boolean, default: true },
  scaleHeight: { type: Number, default: 64 },
  showProjectSelector: { type: Boolean, default: false },
})

const emit = defineEmits(['task-click', 'task-change', 'project-change'])

const containerRef = ref(null)
let controller = null

// --- Scale ---
const currentScale = ref(props.scale)
const scaleOptions = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]
const showScaleDropdown = ref(false)

function setScale(value) {
  currentScale.value = value
  showScaleDropdown.value = false
  if (controller) controller.setScale(value)
}

// --- Closed toggle ---
const closedVisible = ref(props.showClosed)

function loadTaskTableVisibility(fallback) {
  try {
    const stored = localStorage.getItem('mcmc-gantt-task-table')
    if (stored === 'hidden') return false
    if (stored === 'visible') return true
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
  return fallback
}

function saveTaskTableVisibility(visible) {
  try {
    localStorage.setItem('mcmc-gantt-task-table', visible ? 'visible' : 'hidden')
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

const taskTableVisible = ref(loadTaskTableVisibility(props.showTaskTable))

function toggleTaskTable() {
  taskTableVisible.value = !taskTableVisible.value
  saveTaskTableVisibility(taskTableVisible.value)
  if (controller) controller.setGridVisible(taskTableVisible.value)
}

watch(() => props.showTaskTable, (visible) => {
  taskTableVisible.value = visible
  if (controller) controller.setGridVisible(visible)
})

// --- Project selector ---
const projectList = ref([])
const selectedProject = ref(null)
const showProjectDropdown = ref(false)
const projectLoading = ref(false)

async function fetchProjects() {
  if (!props.showProjectSelector) return
  projectLoading.value = true
  try {
    const resp = await fetch(`${props.apiBase}/api/projects`)
    if (resp.ok) {
      projectList.value = await resp.json()
      // Auto-select by prop or first
      const match = projectList.value.find(p => p.id === props.project || p.slug === props.project || p.identifier?.toLowerCase() === props.project?.toLowerCase())
      selectedProject.value = match || projectList.value[0] || null
      // Mount the chart with the resolved project. Without an explicit
      // `project` prop the initial mount has no project to load, so the
      // selector must drive the first mount once projects are known.
      if (selectedProject.value) {
        if (controller) controller.destroy()
        await nextTick()
        initGanttWithProject(selectedProject.value.id)
      }
    }
  } catch (e) { console.error('Failed to fetch projects:', e) }
  finally { projectLoading.value = false }
}

function selectProject(proj) {
  closeSidebars()
  selectedProject.value = proj
  showProjectDropdown.value = false
  emit('project-change', proj)
  // Reload gantt with new project
  if (controller) controller.destroy()
  nextTick(() => initGanttWithProject(proj.id))
}

function initGanttWithProject(projectId) {
  if (!containerRef.value) return
  controller = mountGantt({
    container: containerRef.value,
    project: projectId,
    apiBase: props.apiBase,
    editable: props.editable,
    scale: currentScale.value,
    planeUrl: props.planeUrl,
    workspaceSlug: props.workspaceSlug,
    projectId: projectId,
    showPopup: true,
    showGrid: taskTableVisible.value,
    showZoomControls: props.showZoomControls,
    scaleHeight: props.scaleHeight,
    onTaskClick: (task) => emit('task-click', task),
    onTaskChange: (task) => emit('task-change', task),
    onScaleChange: (level) => { currentScale.value = level },
  })
  const interval = setInterval(() => {
    if (window.gantt && window.gantt.config) { clearInterval(interval); onGanttReady() }
  }, 200)
  setTimeout(() => clearInterval(interval), 10000)
}

watch(closedVisible, () => applyFilters())

// --- Filter ---
const filterOpen = ref(false)
const activeFilters = reactive({ status: [], assignee: [], module: [] })
const filterOptions = reactive({ statuses: ['to do', 'planning', 'in progress', 'complete'], assignees: [], modules: [] })

const activeFilterCount = computed(() => activeFilters.status.length + activeFilters.assignee.length + activeFilters.module.length)

function toggleFilter(type, value) {
  const arr = activeFilters[type]
  const idx = arr.indexOf(value)
  if (idx === -1) arr.push(value)
  else arr.splice(idx, 1)
  applyFilters()
}

function clearFilters() {
  activeFilters.status = []
  activeFilters.assignee = []
  activeFilters.module = []
  applyFilters()
}

// --- Fields panel ---
const {
  fieldsOpen,
  trashOpen,
  toggleFields: toggleFieldsSidebar,
  openTrash: openTrashSidebar,
  closeFields: closeFieldsSidebar,
  closeTrash: closeTrashSidebar,
  closeAll: closeSidebars,
} = useGanttSidebars()
const trashLoading = ref(false)
const trashItems = ref([])
const trashError = ref('')
const trashWidth = ref(440)
const TRASH_MIN_WIDTH = 320
const TRASH_MAX_WIDTH = 640

function startTrashResize(event) {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = trashWidth.value

  const onMove = (moveEvent) => {
    const nextWidth = startWidth + startX - moveEvent.clientX
    trashWidth.value = Math.min(TRASH_MAX_WIDTH, Math.max(TRASH_MIN_WIDTH, nextWidth))
  }
  const onUp = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}
const fields = [
  { key: 'text', label: 'Task Name', alwaysOn: true },
  { key: 'start_date', label: 'Start date' },
  { key: 'end_date', label: 'Due date' },
  { key: 'duration', label: 'Duration' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'progress', label: 'Progress' },
]
const shownFields = reactive(loadFields())

function loadFields() {
  try {
    const s = localStorage.getItem('gantt-view-fields')
    if (s) return JSON.parse(s)
  } catch {}
  return { text: true, start_date: true, end_date: true }
}

function saveFields() { localStorage.setItem('gantt-view-fields', JSON.stringify({ ...shownFields })) }

function toggleField(key) {
  if (shownFields[key]) delete shownFields[key]
  else shownFields[key] = true
  saveFields()
  rebuildColumns()
}

// Close transient SDK UI when the user clicks anywhere outside its box.
// Task detail popups keep using core.js's own full-page overlay.
function handleOutsidePointerDown(event) {
  const target = event.target
  if (!(target instanceof Element)) return

  if (filterOpen.value &&
      !target.closest('.gv-filter-dropdown') &&
      !target.closest('.gv-filter-trigger')) {
    filterOpen.value = false
  }
  if (fieldsOpen.value &&
      !target.closest('.gv-fields-panel') &&
      !target.closest('.gv-fields-trigger')) {
    closeFieldsSidebar()
  }
  if (trashOpen.value &&
      !target.closest('.gv-trash-panel') &&
      !target.closest('.gv-trash-trigger')) {
    closeTrashSidebar()
  }
  if (showProjectDropdown.value &&
      !target.closest('.gv-project-menu') &&
      !target.closest('.gv-project-trigger')) {
    showProjectDropdown.value = false
  }
  if (showScaleDropdown.value &&
      !target.closest('.gv-scale-menu') &&
      !target.closest('.gv-scale-trigger')) {
    showScaleDropdown.value = false
  }
}

// --- Gantt lifecycle ---
onMounted(() => {
  document.addEventListener('pointerdown', handleOutsidePointerDown, true)
  if (props.showProjectSelector) {
    // The selector fetches projects and mounts the chart with the resolved
    // project; a parallel empty initGantt() would load a project-less chart.
    fetchProjects()
  } else {
    initGantt()
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
  if (controller) {
    controller.destroy()
    controller = null
  }
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
    scale: currentScale.value,
    planeUrl: props.planeUrl,
    workspaceSlug: props.workspaceSlug,
    projectId: props.projectId,
    showPopup: true,
    showGrid: taskTableVisible.value,
    showZoomControls: props.showZoomControls,
    scaleHeight: props.scaleHeight,
    onTaskClick: (task) => emit('task-click', task),
    onTaskChange: (task) => emit('task-change', task),
    onScaleChange: (level) => { currentScale.value = level },
  })

  // Wait for gantt to be ready then apply overrides
  const interval = setInterval(() => {
    if (window.gantt && window.gantt.config) {
      clearInterval(interval)
      onGanttReady()
    }
  }, 200)
  setTimeout(() => clearInterval(interval), 10000)
}

function onGanttReady() {
  rebuildColumns()
  extractFilterOptions()
  applyFilters()

  window.gantt.attachEvent('onGanttRender', () => {
    setTimeout(extractFilterOptions, 100)
  })
}

function rebuildColumns() {
  const gantt = window.gantt
  if (!gantt) return
  const cols = [{ name: 'text', label: 'Name', tree: true, width: 200, resize: true }]
  if (shownFields.start_date) cols.push({ name: 'start_date', label: 'Start', align: 'center', width: 90, resize: true, template: t => fmtCol(t.start_date) })
  if (shownFields.end_date) cols.push({ name: 'end_date', label: 'Due', align: 'center', width: 90, resize: true, template: t => fmtCol(t.end_date) })
  if (shownFields.duration) cols.push({ name: 'duration', label: 'Days', align: 'center', width: 45 })
  if (shownFields.status) cols.push({ name: 'status', label: 'Status', align: 'center', width: 80, template: t => capitalize(t.status) })
  if (shownFields.assignee) cols.push({ name: 'assignee', label: 'Assignee', align: 'center', width: 90, template: t => t.assignee || '' })
  if (shownFields.priority) cols.push({ name: 'priority', label: 'Priority', align: 'center', width: 70, template: t => t.priority || '' })
  if (shownFields.progress) cols.push({ name: 'progress', label: '%', align: 'center', width: 45, template: t => Math.round((t.progress || 0) * 100) + '%' })
  gantt.config.columns = cols
  gantt.render()
}

function applyFilters() {
  if (!window.gantt) return
  window.gantt.attachEvent('onBeforeTaskDisplay', (id, task) => {
    if (!closedVisible.value && task.status === 'complete') return false
    if (activeFilters.status.length && task.plane_type !== 'module' && !activeFilters.status.includes(task.status)) return false
    if (activeFilters.assignee.length && task.plane_type !== 'module') {
      const a = (task.assignee || '').split(',').map(s => s.trim())
      if (!activeFilters.assignee.some(x => a.includes(x))) return false
    }
    if (activeFilters.module.length) {
      if (task.plane_type === 'module') {
        const n = (task.text || '').replace(/^[\u{1F4E6}\u{1F504}]\s*/u, '')
        if (!activeFilters.module.includes(n)) return false
      } else if (task.parent) {
        const p = window.gantt.isTaskExists(task.parent) ? window.gantt.getTask(task.parent) : null
        if (p && p.plane_type === 'module') {
          const n = (p.text || '').replace(/^[\u{1F4E6}\u{1F504}]\s*/u, '')
          if (!activeFilters.module.includes(n)) return false
        }
      }
    }
    return true
  })
  window.gantt.render()
}

function extractFilterOptions() {
  if (!window.gantt) return
  const aSet = new Set(), mSet = new Set()
  window.gantt.eachTask(t => {
    if (t.assignee) t.assignee.split(',').forEach(a => { const v = a.trim(); if (v) aSet.add(v) })
    if (t.plane_type === 'module') { const n = (t.text || '').replace(/^[\u{1F4E6}\u{1F504}]\s*/u, ''); if (n) mSet.add(n) }
  })
  filterOptions.assignees = [...aSet].sort()
  filterOptions.modules = [...mSet].sort()
}

// Helpers
function fmtCol(d) {
  if (!d) return ''
  const dt = d instanceof Date ? d : new Date(d)
  if (isNaN(dt)) return ''
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}
function capitalize(s) { return s ? s.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ') : '' }

function activeProjectId() {
  return selectedProject.value?.id || props.project
}

function reloadChart() {
  const projectId = activeProjectId()
  if (!window.gantt || !projectId) return
  window.gantt.clearAll()
  window.gantt.load(`${props.apiBase}/api/projects/${projectId}/data?bypass_cache=true`)
}

async function openTrash() {
  openTrashSidebar()
  trashLoading.value = true
  trashError.value = ''
  try {
    const response = await fetch(`${props.apiBase}/api/projects/${activeProjectId()}/trash`)
    if (!response.ok) throw new Error(`Failed to load Trash (${response.status})`)
    trashItems.value = (await response.json()).items || []
  } catch (error) {
    trashError.value = error.message || 'Trash could not be loaded.'
  } finally {
    trashLoading.value = false
  }
}

async function restoreTrashItem(item) {
  const response = await fetch(
    `${props.apiBase}/api/projects/${activeProjectId()}/trash/${item.entity_type}/${item.entity_id}/restore`,
    { method: 'POST' },
  )
  if (!response.ok) throw new Error(`Failed to restore item (${response.status})`)
  trashItems.value = trashItems.value.filter(value => value.entity_id !== item.entity_id)
  reloadChart()
}

async function deleteTrashItem(item) {
  if (!window.confirm(`Delete “${item.name}” forever? This cannot be undone.`)) return
  const response = await fetch(
    `${props.apiBase}/api/projects/${activeProjectId()}/trash/${item.entity_type}/${item.entity_id}?confirm=true`,
    { method: 'DELETE' },
  )
  if (!response.ok) throw new Error(`Failed to permanently delete item (${response.status})`)
  trashItems.value = trashItems.value.filter(value => value.entity_id !== item.entity_id)
}

function daysUntilPurge(item) {
  return Math.max(0, Math.ceil((new Date(item.purge_at) - Date.now()) / 86400000))
}

// Toolbar actions
function handleToday() { if (window.gantt) window.gantt.showDate(new Date()) }
function handleAutoFit() { if (window.gantt) { window.gantt.config.fit_tasks = true; window.gantt.render() } }
function handleExport() {
  if (!window.gantt) return
  const tasks = []
  window.gantt.eachTask(function(task) {
    if (task.plane_type === 'module' || task.plane_type === 'cycle') return
    const start = task.start_date instanceof Date ? task.start_date.toISOString().split('T')[0] : ''
    const end = task.end_date instanceof Date ? task.end_date.toISOString().split('T')[0] : ''
    tasks.push([task.text || '', task.status || '', task.assignee || '', start, end, task.duration || '', task.priority || ''])
  })
  if (!tasks.length) return
  const headers = ['Name','Status','Assignee','Start Date','End Date','Duration (days)','Priority']
  const csv = [headers.join(','), ...tasks.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.project}_export_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="gantt-view" :style="{ height }">
    <!-- Toolbar -->
    <div v-if="showToolbar" class="gv-toolbar">
      <div class="gv-toolbar-left">
        <button
          class="gv-btn gv-table-toggle"
          :class="{ active: !taskTableVisible }"
          :title="taskTableVisible ? 'Hide task table' : 'Show task table'"
          :aria-label="taskTableVisible ? 'Hide task table' : 'Show task table'"
          :aria-pressed="!taskTableVisible"
          @click="toggleTaskTable"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2"/>
            <line x1="9" y1="4" x2="9" y2="20"/>
          </svg>
          Task table
        </button>
        <button class="gv-btn" @click="handleToday">Today</button>
        <div class="gv-dropdown-wrap">
          <button class="gv-btn gv-scale-trigger" @click="showScaleDropdown = !showScaleDropdown">
            {{ scaleOptions.find(s => s.value === currentScale)?.label || 'Week' }} ▾
          </button>
          <div v-if="showScaleDropdown" class="gv-dropdown-menu gv-scale-menu">
            <button v-for="opt in scaleOptions" :key="opt.value" class="gv-dropdown-item" :class="{ active: currentScale === opt.value }" @click="setScale(opt.value)">{{ opt.label }}</button>
          </div>
        </div>
        <button class="gv-btn" @click="handleAutoFit">Auto Fit</button>
        <button class="gv-btn" @click="handleExport">Export</button>
      </div>
      <div class="gv-toolbar-right">
        <!-- Project selector — immediately left of Trash -->
        <div v-if="showProjectSelector" class="gv-dropdown-wrap">
          <button class="gv-btn gv-project-btn gv-project-trigger" @click="showProjectDropdown = !showProjectDropdown">
            {{ selectedProject?.title || selectedProject?.identifier || 'Select project' }} ▾
          </button>
          <div v-if="showProjectDropdown" class="gv-dropdown-menu gv-project-menu gv-project-menu-right">
            <button v-if="projectLoading" class="gv-dropdown-item" disabled>Loading...</button>
            <button
              v-for="p in projectList"
              :key="p.id"
              class="gv-dropdown-item"
              :class="{ active: selectedProject?.id === p.id }"
              @click="selectProject(p)"
            >
              <span class="gv-project-id">{{ p.identifier }}</span> {{ p.title }}
            </button>
          </div>
        </div>
        <button class="gv-btn gv-trash-trigger" :class="{ active: trashOpen }" @click="openTrash">Trash</button>
        <button v-if="showFilter" class="gv-btn gv-filter-trigger" :class="{ active: filterOpen || activeFilterCount > 0 }" @click="filterOpen = !filterOpen">
          Filter <span v-if="activeFilterCount" class="gv-badge">{{ activeFilterCount }}</span>
        </button>
        <button class="gv-btn" :class="{ active: closedVisible }" @click="closedVisible = !closedVisible">
          <span class="gv-dot" :class="{ on: closedVisible }"></span> Closed
        </button>
        <button v-if="showFields" class="gv-btn gv-fields-trigger" :class="{ active: fieldsOpen }" @click="toggleFieldsSidebar">Fields</button>
      </div>
    </div>

    <!-- Filter dropdown -->
    <div v-if="filterOpen" class="gv-filter-dropdown">
      <div class="gv-filter-header">
        <span>Filters</span>
        <button v-if="activeFilterCount" class="gv-filter-clear" @click="clearFilters">Clear</button>
      </div>
      <div class="gv-filter-body">
        <div class="gv-filter-group">
          <div class="gv-filter-group-label">Status</div>
          <div class="gv-filter-chips">
            <button v-for="s in filterOptions.statuses" :key="s" class="gv-chip" :class="{ active: activeFilters.status.includes(s) }" @click="toggleFilter('status', s)">{{ capitalize(s) }}</button>
          </div>
        </div>
        <div v-if="filterOptions.modules.length" class="gv-filter-group">
          <div class="gv-filter-group-label">Workstream</div>
          <div class="gv-filter-chips">
            <button v-for="m in filterOptions.modules" :key="m" class="gv-chip" :class="{ active: activeFilters.module.includes(m) }" @click="toggleFilter('module', m)">{{ m }}</button>
          </div>
        </div>
        <div v-if="filterOptions.assignees.length" class="gv-filter-group">
          <div class="gv-filter-group-label">Assignee</div>
          <div class="gv-filter-chips">
            <button v-for="a in filterOptions.assignees" :key="a" class="gv-chip" :class="{ active: activeFilters.assignee.includes(a) }" @click="toggleFilter('assignee', a)">{{ a }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart shell keeps all side panels below the toolbar -->
    <div class="gv-chart-shell">
      <!-- Gantt chart -->
      <div ref="containerRef" class="gv-chart"></div>

      <!-- Empty state — shown whenever no project is selected. On a normal
           load a project auto-selects, so this appears only when auto-select
           can't resolve one (still loading, fetch error, or no projects). -->
      <div v-if="showProjectSelector && !selectedProject" class="gv-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        <p class="gv-empty-title">Please select a project</p>
        <p class="gv-empty-sub">Use the “Select project” menu above to load its Gantt chart.</p>
      </div>

      <!-- Fields panel -->
    <Transition name="gv-slide">
      <div v-if="fieldsOpen" class="gv-fields-panel">
        <div class="gv-fields-header">
          <span>Fields</span>
          <button @click="closeFieldsSidebar">✕</button>
        </div>
        <div class="gv-fields-body">
          <div v-for="f in fields" :key="f.key" class="gv-field-row">
            <span>{{ f.label }}</span>
            <label class="gv-toggle">
              <input type="checkbox" :checked="!!shownFields[f.key]" :disabled="f.alwaysOn" @change="toggleField(f.key)" />
              <span class="gv-toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="gv-slide">
      <div v-if="trashOpen" class="gv-trash-panel" :style="{ width: `${trashWidth}px` }">
        <button
          type="button"
          class="gv-trash-resizer"
          aria-label="Resize trash sidebar"
          @pointerdown="startTrashResize"
        ></button>
        <div class="gv-fields-header">
          <div><strong>Trash</strong><small>Items are deleted forever after 30 days.</small></div>
          <button @click="closeTrashSidebar">✕</button>
        </div>
        <div class="gv-trash-body">
          <div v-if="trashLoading" class="gv-trash-empty">Loading…</div>
          <div v-else-if="trashError" class="gv-trash-empty gv-trash-error">{{ trashError }}</div>
          <div v-else-if="!trashItems.length" class="gv-trash-empty">Trash is empty.</div>
          <template v-else>
            <div v-for="item in trashItems" :key="`${item.entity_type}-${item.entity_id}`" class="gv-trash-row">
              <div class="gv-trash-copy">
                <span class="gv-trash-type">{{ capitalize(item.gantt_type) }}</span>
                <strong>{{ item.name }}</strong>
                <small>Deletes in {{ daysUntilPurge(item) }} days</small>
              </div>
              <div class="gv-trash-actions">
                <button @click="restoreTrashItem(item)">Restore</button>
                <button class="danger" @click="deleteTrashItem(item)">Delete forever</button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
    </div>
  </div>
</template>

<style scoped>
.gantt-view {
  display: flex;
  flex-direction: column;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
/* Toolbar */
.gv-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.gv-toolbar-left, .gv-toolbar-right { display: flex; align-items: center; gap: 4px; }
.gv-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
}
.gantt-view .gv-toolbar .gv-btn {
  color: #334155 !important;
}
.gv-btn:hover { background: #f1f5f9; }
/* Header controls use a neutral active state rather than the application's
   blue accent so every toolbar action reads consistently. */
.gantt-view .gv-toolbar .gv-btn.active,
.gantt-view .gv-toolbar .gv-table-toggle.active {
  background: #e2e8f0 !important;
  color: #334155 !important;
}
.gv-project-btn { font-weight: 600; border: 1px solid #e2e8f0; border-radius: 6px; padding: 5px 12px; }
.gv-project-menu { min-width: 220px; max-height: 260px; overflow-y: auto; }
.gv-project-menu-right { left: auto; right: 0; }
.gv-project-id { font-size: 10px; font-weight: 700; color: #94a3b8; background: #f1f5f9; padding: 1px 5px; border-radius: 3px; margin-right: 4px; }
.gv-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #475569 !important;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
.gv-dot {
  width: 10px; height: 10px; border-radius: 50%; border: 2px solid #cbd5e1; margin-right: 2px;
}
.gantt-view .gv-toolbar .gv-dot.on {
  background: #475569 !important;
  border-color: #475569 !important;
}
/* Dropdown */
.gv-dropdown-wrap { position: relative; }
.gv-dropdown-menu {
  position: absolute; top: 100%; left: 0; margin-top: 4px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08); z-index: 100; padding: 4px; min-width: 90px;
}
.gv-dropdown-item {
  display: block; width: 100%; padding: 6px 10px; border: none; border-radius: 4px;
  background: transparent; font-size: 12px; color: #475569; cursor: pointer; text-align: left;
}
.gv-dropdown-item:hover { background: #f1f5f9; }
.gv-dropdown-item.active { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
/* Filter */
.gv-filter-dropdown {
  position: absolute; top: 44px; right: 100px; width: 320px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1); z-index: 55; overflow: hidden;
}
.gv-filter-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; font-weight: 600; color: #1e293b;
}
.gv-filter-clear { border: none; background: transparent; font-size: 11px; font-weight: 600; color: #dc2626; cursor: pointer; }
.gv-filter-body { padding: 10px 14px 14px; overflow: visible; }
.gv-filter-group { margin-bottom: 12px; }
.gv-filter-group:last-child { margin-bottom: 0; }
.gv-filter-group-label { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
.gv-filter-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.gv-chip {
  padding: 4px 9px; border: 1px solid #e2e8f0; border-radius: 5px;
  background: #fff; font-size: 11px; font-weight: 500; color: #475569; cursor: pointer;
}
.gv-chip:hover { background: #f8fafc; border-color: #cbd5e1; }
.gv-chip.active { background: #eff6ff; border-color: #93c5fd; color: #1d4ed8; font-weight: 600; }
/* Chart and side panels */
.gv-chart-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.gv-empty {
  position: absolute; inset: 0; z-index: 5;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; background: #fff; color: #94a3b8; text-align: center; pointer-events: none;
}
.gv-empty-title { margin: 6px 0 0; font-size: 15px; font-weight: 600; color: #475569; }
.gv-empty-sub { margin: 0; font-size: 13px; color: #94a3b8; }
.gv-chart {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}
/* Fields panel */
.gv-fields-panel {
  position: absolute; top: 0; right: 0; bottom: 0; width: 240px;
  background: #fff; border-left: 1px solid #e2e8f0; z-index: 50;
  display: flex; flex-direction: column; box-shadow: -2px 0 8px rgba(0,0,0,0.04);
}
.gv-trash-panel {
  position: absolute; top: 0; right: 0; bottom: 0; max-width: 92%;
  background: #fff; border-left: 1px solid #e2e8f0; z-index: 60;
  display: flex; flex-direction: column; box-shadow: -8px 0 24px rgba(15,23,42,.08);
}
.gv-trash-resizer {
  position: absolute; top: 0; bottom: 0; left: -5px; width: 10px;
  padding: 0; border: 0; background: transparent; cursor: col-resize; z-index: 1;
}
.gv-trash-resizer::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: 4px; width: 2px;
  background: #60a5fa; opacity: 0; transition: opacity 140ms ease;
}
.gv-trash-resizer:hover::after,
.gv-trash-resizer:focus-visible::after { opacity: 1; }
.gv-fields-header div { display: flex; flex-direction: column; gap: 3px; }
.gv-fields-header small { font-size: 11px; font-weight: 400; color: #64748b; }
.gv-trash-body { flex: 1; overflow-y: auto; padding: 10px 14px; }
.gv-trash-empty { padding: 28px 8px; text-align: center; color: #94a3b8; font-size: 13px; }
.gv-trash-error { color: #b91c1c; }
.gv-trash-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
.gv-trash-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
.gv-trash-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: #1e293b; }
.gv-trash-copy small { font-size: 10px; color: #94a3b8; }
.gv-trash-type { align-self: flex-start; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #64748b; font-size: 9px; font-weight: 700; text-transform: uppercase; }
.gv-trash-actions { display: flex; flex-direction: column; gap: 5px; }
.gv-trash-actions button { padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 5px; background: #fff; color: #2563eb; font-size: 10px; cursor: pointer; }
.gv-trash-actions button.danger { color: #b91c1c; border-color: #fecaca; }
.gv-fields-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 14px 10px; border-bottom: 1px solid #f1f5f9;
  font-size: 14px; font-weight: 700; color: #1e293b;
}
.gv-fields-header button { border: none; background: transparent; font-size: 16px; color: #94a3b8; cursor: pointer; }
.gv-fields-body { flex: 1; overflow-y: auto; padding: 10px 14px; }
.gv-field-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f8fafc; font-size: 13px; color: #1e293b; }
/* Toggle */
.gv-toggle { position: relative; width: 32px; height: 18px; }
.gv-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.gv-toggle-slider {
  position: absolute; inset: 0; background: #cbd5e1; border-radius: 9px; cursor: pointer; transition: background 0.2s;
}
.gv-toggle-slider::before {
  content: ""; position: absolute; left: 2px; top: 2px; width: 14px; height: 14px;
  background: #fff; border-radius: 50%; transition: transform 0.2s;
}
.gv-toggle input:checked + .gv-toggle-slider { background: #2563eb; }
.gv-toggle input:checked + .gv-toggle-slider::before { transform: translateX(14px); }
.gv-toggle input:disabled + .gv-toggle-slider { opacity: 0.5; cursor: not-allowed; }
/* Transition */
.gv-slide-enter-active, .gv-slide-leave-active { transition: transform 0.2s ease; }
.gv-slide-enter-from, .gv-slide-leave-to { transform: translateX(100%); }
</style>
