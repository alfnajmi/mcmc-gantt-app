/**
 * Core Gantt engine — wraps DHTMLX Gantt, manages lifecycle and API communication.
 * Used by both the Web Component and Vue wrapper.
 */

import { createEditSidebar } from './sidebar.js'

const DATE_FMT = '%Y-%m-%d %H:%i'

function formatDate(d) {
  if (!d) return ''
  if (typeof d === 'string') d = new Date(d)
  var dd = String(d.getDate()).padStart(2, '0')
  var mm = String(d.getMonth() + 1).padStart(2, '0')
  var yyyy = d.getFullYear()
  return dd + '/' + mm + '/' + yyyy
}

function capitalizeStatus(status) {
  if (!status) return ''
  return status.split(' ').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1) }).join(' ')
}

const DEFAULT_COLUMNS = [
  { name: 'text', label: 'Task', tree: true, width: 220, resize: true },
  { name: 'start_date', label: 'Start', align: 'center', width: 100, resize: true, template: function(task) {
    return formatDate(task.start_date)
  }},
  { name: 'end_date', label: 'End', align: 'center', width: 100, resize: true, template: function(task) {
    return formatDate(task.end_date)
  }},
  { name: 'duration', label: 'Days', align: 'center', width: 45 },
  { name: 'status', label: 'Status', align: 'center', width: 90, template: function(task) {
    return capitalizeStatus(task.status)
  }},
]

const EDITABLE_COLUMNS = [...DEFAULT_COLUMNS, { name: 'add', width: 36 }]

const SCALES = {
  year: [
    { unit: 'year', step: 1, format: '%Y' },
    { unit: 'month', step: 3, format: '%M' },
  ],
  day: [{ unit: 'day', step: 1, format: '%d %M' }],
  week: [
    { unit: 'week', step: 1, format: 'Week %W' },
    { unit: 'day', step: 1, format: '%d %D' },
  ],
  month: [
    { unit: 'month', step: 1, format: '%F %Y' },
    { unit: 'week', step: 1, format: '%W' },
  ],
}

// Custom CSS injected into the page for Gantt styling
// IMPORTANT: Keep in sync with gantt-app/frontend/project.html styles.
// See README.md "Style Synchronisation" section.
const GANTT_CUSTOM_CSS = `
  /* --- Grid --- */
  .gantt_grid {
    border-right: 1px solid #e2e8f0 !important;
  }
  .gantt_grid_head_cell {
    font-size: 11px !important;
    font-weight: 600 !important;
    color: #64748b !important;
    text-transform: uppercase !important;
    letter-spacing: 0.02em;
    border-bottom: 1px solid #e2e8f0 !important;
    overflow: visible !important;
  }
  .gantt_grid_head_row {
    background: #fff !important;
    border-bottom: 1px solid #e2e8f0 !important;
  }
  .gantt_row {
    border-bottom: none !important;
  }
  .gantt_row:hover,
  .gantt_row.hover {
    background: #f1f5f9 !important;
  }
  .gantt_row.gantt_selected,
  .gantt_row.gantt_selected .gantt_cell {
    background: #eff6ff !important;
  }
  .gantt_task_row {
    border-bottom: none !important;
  }
  .gantt_task_row:hover,
  .gantt_task_row.hover {
    background: #f1f5f9 !important;
  }
  .gantt_task_row.gantt_selected {
    background: #eff6ff !important;
  }
  .gantt_tree_content {
    font-size: 13px !important;
    color: #1e293b !important;
  }
  .gantt_row.gantt_project .gantt_tree_content {
    font-weight: 700 !important;
  }

  /* --- Scale (timeline header) --- */
  .gantt_scale_line {
    border-bottom: 1px solid #e2e8f0 !important;
  }
  .gantt_scale_cell {
    font-size: 11px !important;
    font-weight: 500 !important;
    color: #64748b !important;
    border-right: 1px solid #f1f5f9 !important;
  }

  /* --- Task bars --- */
  .gantt_task_line {
    border-radius: 4px !important;
  }
  .gantt_task_line .gantt_task_progress {
    background: rgba(0,0,0,0.15);
    border-radius: 4px;
  }

  /* Status-based bar colors */
  .gantt_task_line.status-complete {
    background: #22c55e !important;
    border-color: #16a34a !important;
  }
  .gantt_task_line.status-in-progress {
    background: #3b82f6 !important;
    border-color: #2563eb !important;
  }
  .gantt_task_line.status-planning {
    background: #a78bfa !important;
    border-color: #7c3aed !important;
  }
  .gantt_task_line.status-todo {
    background: #94a3b8 !important;
    border-color: #64748b !important;
  }

  /* Default task (no status) — light blue */
  .gantt_task_line.gantt_task {
    background: #93c5fd !important;
    border-color: #60a5fa !important;
    border-radius: 4px;
  }

  /* Project bar — green, thin line */
  .gantt_task_line.gantt_project {
    background: #22c55e !important;
    border-color: #16a34a !important;
    border-radius: 4px;
    height: 8px !important;
    margin-top: 12px;
  }

  /* Milestone */
  .gantt_task_line.milestone_task {
    background: #f59e0b !important;
    border-color: #f59e0b !important;
  }

  .gantt_task_cell {
    border-right: 1px solid #f1f5f9 !important;
  }

  .gantt_task_bg {
    height: 100% !important;
  }

  /* --- Weekend striping — diagonal hatched pattern --- */
  .weekend-cell {
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 3px,
      rgba(148, 163, 184, 0.08) 3px,
      rgba(148, 163, 184, 0.08) 6px
    ) !important;
    background-color: rgba(241, 245, 249, 0.6) !important;
  }

  /* --- Today line — dashed pink left border --- */
  .today-cell {
    border-left: 2px dashed #e84393 !important;
  }

  /* Today's date highlighted in scale header */
  .gantt_scale_cell.scale-today {
    color: #e84393 !important;
    font-weight: 700 !important;
    position: relative;
  }
  .gantt_scale_cell.scale-today::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(232, 67, 147, 0.12);
    z-index: -1;
  }

  /* Hide default marker (using cell border approach instead) */
  .gantt_marker {
    display: none !important;
  }

  /* --- Lightbox (task edit popup) --- */
  .gantt_cal_light {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif !important;
    border-radius: 12px !important;
    border: 1px solid #e2e8f0 !important;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12) !important;
    overflow: hidden;
    width: 450px !important;
  }
  .gantt_cal_ltitle {
    background: #fff !important;
    border-bottom: 1px solid #e2e8f0 !important;
    padding: 16px 20px !important;
    height: auto !important;
    line-height: normal !important;
  }
  .gantt_cal_ltitle span {
    font-size: 16px !important;
    font-weight: 700 !important;
    color: #1e293b !important;
  }
  .gantt_cal_larea {
    background: #fff !important;
    padding: 16px 20px !important;
    overflow-y: auto !important;
  }
  .gantt_cal_lsection {
    font-size: 12px !important;
    font-weight: 600 !important;
    color: #64748b !important;
    padding: 8px 0 4px !important;
    border: none !important;
  }
  .gantt_wrap_section {
    overflow: visible !important;
  }
  .gantt_cal_ltext textarea {
    font-family: inherit !important;
    font-size: 13px !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 6px !important;
    padding: 10px 12px !important;
    background: #fff !important;
    resize: none !important;
  }
  .gantt_cal_ltext textarea:focus {
    outline: none !important;
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08) !important;
  }
  .gantt_section_select,
  .gantt_cal_larea .gantt_section_select {
    overflow: visible !important;
    height: auto !important;
    min-height: 38px !important;
    padding: 2px 0 4px !important;
    border: none !important;
  }
  .gantt_section_select select,
  .gantt_cal_larea select {
    font-family: inherit !important;
    font-size: 13px !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 6px !important;
    padding: 8px 10px !important;
    background: #fff !important;
    color: #1e293b !important;
    width: 100% !important;
    box-sizing: border-box !important;
    appearance: auto !important;
  }
  .gantt_section_select select:focus,
  .gantt_cal_larea select:focus {
    outline: none !important;
    border-color: #2563eb !important;
  }
  .gantt_section_time {
    background: transparent !important;
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 4px 0 !important;
  }
  .gantt_section_time select {
    width: auto !important;
    min-width: 50px !important;
    padding: 6px 8px !important;
  }
  .gantt_section_time input {
    font-family: inherit !important;
    font-size: 13px !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 6px !important;
    padding: 8px 10px !important;
    background: #fff !important;
  }
  .gantt_cal_lfoot {
    background: #fff !important;
    border-top: 1px solid #e2e8f0 !important;
    padding: 12px 20px !important;
    display: flex !important;
    justify-content: flex-end !important;
    gap: 8px !important;
  }
  .gantt_cal_lfoot .gantt_btn_set {
    border-radius: 6px !important;
    padding: 8px 16px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    font-family: inherit !important;
    border: 1px solid #e2e8f0 !important;
    cursor: pointer !important;
    margin: 0 !important;
    height: auto !important;
    line-height: normal !important;
  }
  .gantt_cal_lfoot .gantt_save_btn_set {
    background: #2563eb !important;
    color: #fff !important;
    border-color: #2563eb !important;
  }
  .gantt_cal_lfoot .gantt_save_btn_set:hover {
    background: #1d4ed8 !important;
  }
  .gantt_cal_lfoot .gantt_cancel_btn_set {
    background: #fff !important;
    color: #1e293b !important;
  }
  .gantt_cal_lfoot .gantt_cancel_btn_set:hover {
    background: #f8fafc !important;
  }
  .gantt_cal_lfoot .gantt_delete_btn_set {
    background: transparent !important;
    color: #dc2626 !important;
    border-color: transparent !important;
    margin-right: auto !important;
  }
  .gantt_cal_lfoot .gantt_delete_btn_set:hover {
    background: #fef2f2 !important;
  }
  .gantt_cal_cover {
    background: rgba(0, 0, 0, 0.08) !important;
    opacity: 1 !important;
  }

  /* --- Confirm/Alert popup --- */
  .gantt_modal_box {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif !important;
    border-radius: 8px !important;
    border: 1px solid #e2e8f0 !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.1) !important;
    overflow: visible !important;
    padding: 12px 16px !important;
    background: #fff !important;
    min-width: 220px !important;
    max-width: 320px !important;
    width: auto !important;
  }
  .gantt_popup_title {
    display: none !important;
  }
  .gantt_popup_text {
    font-size: 13px !important;
    color: #1e293b !important;
    padding: 0 0 12px !important;
    margin: 0 !important;
    border: none !important;
    text-align: left !important;
    line-height: 1.5 !important;
  }
  .gantt_popup_controls {
    display: flex !important;
    justify-content: flex-start !important;
    gap: 8px !important;
    padding: 0 !important;
  }
  .gantt_popup_button {
    border-radius: 4px !important;
    padding: 5px 12px !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    font-family: inherit !important;
    border: none !important;
    cursor: pointer !important;
    margin: 0 !important;
    background: transparent !important;
    color: #64748b !important;
    transition: all 0.15s !important;
  }
  .gantt_popup_button:hover {
    background: #f1f5f9 !important;
    color: #1e293b !important;
  }
  .gantt_popup_button.gantt_ok_button {
    background: #dc2626 !important;
    color: #fff !important;
    border: none !important;
    border-radius: 4px !important;
    padding: 5px 14px !important;
  }
  .gantt_popup_button.gantt_ok_button:hover {
    background: #b91c1c !important;
  }

  /* --- Task Detail Popup --- */
  .gantt-task-popup-overlay {
    position: fixed;
    inset: 0;
    z-index: 9998;
  }
  .gantt-task-popup {
    position: fixed;
    z-index: 9999;
    width: 300px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
    padding: 14px 16px;
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    font-size: 13px;
    animation: gantt-popup-in 0.15s ease;
  }
  @keyframes gantt-popup-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .gantt-task-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .gantt-task-popup-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .gantt-task-popup-badge {
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .gantt-task-popup-badge.badge-task {
    background: #dbeafe;
    color: #2563eb;
  }
  .gantt-task-popup-badge.badge-project {
    background: #ede9fe;
    color: #7c3aed;
  }
  .gantt-task-popup-id {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
  }
  .gantt-task-popup-close {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
  }
  .gantt-task-popup-close:hover {
    background: #f1f5f9;
    color: #475569;
  }
  .gantt-task-popup-title {
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
    margin: 0 0 12px;
    line-height: 1.4;
  }
  .gantt-task-popup-props {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    padding: 10px 12px;
    background: #f8fafc;
    border-radius: 8px;
  }
  .gantt-task-popup-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .gantt-task-popup-label {
    font-size: 11px;
    color: #64748b;
    font-weight: 500;
  }
  .gantt-task-popup-value {
    font-size: 11px;
    color: #1e293b;
    font-weight: 500;
  }
  .gantt-task-popup-actions {
    display: flex;
    gap: 8px;
  }
  .gantt-task-popup-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    background: #fff;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    text-decoration: none;
  }
  .gantt-task-popup-btn:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
  .gantt-task-popup-btn.btn-plane {
    background: #7c3aed;
    border-color: #7c3aed;
    color: #fff;
  }
  .gantt-task-popup-btn.btn-plane:hover {
    background: #6d28d9;
  }
`

/**
 * Mount a Gantt chart into a container element.
 *
 * @param {Object} options
 * @param {HTMLElement} options.container - DOM element to render into
 * @param {string} options.project - Project slug
 * @param {string} [options.apiBase=''] - Base URL of the Gantt API
 * @param {boolean} [options.editable=false] - Allow editing
 * @param {string} [options.scale='month'] - Initial scale: day|week|month|year
 * @param {string} [options.planeUrl=''] - Plane instance URL (enables "View in Plane" popup)
 * @param {string} [options.workspaceSlug=''] - Plane workspace slug
 * @param {string} [options.projectId=''] - Plane project UUID (for Plane links)
 * @param {boolean} [options.showPopup=true] - Show task detail popup on bar click
 * @param {Function} [options.onTaskClick] - Callback when task is clicked
 * @param {Function} [options.onTaskChange] - Callback when task is updated
 * @returns {Object} Controller with destroy() method
 */
export function mountGantt(options) {
  const {
    container,
    project,
    apiBase = '',
    editable = false,
    scale = 'month',
    planeUrl = '',
    workspaceSlug = '',
    projectId = '',
    showPopup = true,
    onTaskClick = null,
    onTaskChange = null,
  } = options

  if (!container || !project) {
    throw new Error('mountGantt requires "container" and "project" options.')
  }

  // Dynamically load DHTMLX Gantt if not already loaded
  const ganttReady = ensureGanttLoaded()

  let destroyed = false
  let dpInstance = null

  ganttReady.then(() => {
    if (destroyed) return

    const gantt = window.gantt

    // Inject custom CSS
    injectCustomCSS()

    // Configuration
    gantt.config.date_format = DATE_FMT
    gantt.config.drag_progress = editable
    gantt.config.drag_links = editable
    gantt.config.drag_move = editable
    gantt.config.drag_resize = editable
    gantt.config.order_branch = editable
    gantt.config.open_tree_initially = true
    gantt.config.readonly = !editable
    gantt.config.auto_types = true
    gantt.config.fit_tasks = true
    gantt.config.row_height = 36
    gantt.config.bar_height = 22
    gantt.config.grid_resize = true
    gantt.config.columns = editable ? EDITABLE_COLUMNS : DEFAULT_COLUMNS
    gantt.config.scales = SCALES[scale] || SCALES.month

    // Lightbox (for editable mode)
    gantt.config.lightbox.sections = [
      { name: 'description', height: 50, map_to: 'text', type: 'textarea', focus: true },
      {
        name: 'status', height: 30, map_to: 'status', type: 'select',
        options: [
          { key: '', label: '— None —' },
          { key: 'to do', label: 'To Do' },
          { key: 'planning', label: 'Planning' },
          { key: 'in progress', label: 'In Progress' },
          { key: 'complete', label: 'Complete' },
        ],
      },
      { name: 'assignee', height: 30, map_to: 'assignee', type: 'textarea' },
      { name: 'type', type: 'typeselect', map_to: 'type' },
      { name: 'time', type: 'time', map_to: 'auto' },
    ]
    gantt.locale.labels.section_status = 'Status'
    gantt.locale.labels.section_assignee = 'Assignee'

    // Task styling — status-based CSS classes (synced with project.html)
    gantt.templates.task_class = function(start, end, task) {
      var classes = []
      if (task.type === 'project') classes.push('gantt_project')
      else if (task.type === 'milestone') classes.push('milestone_task')
      else classes.push('gantt_task')

      // Status-based coloring
      if (task.status) {
        var s = task.status.toLowerCase().replace(/\s+/g, '-')
        classes.push('status-' + s)
      }
      return classes.join(' ')
    }

    // Timeline cell styling — weekend striping + today marker (synced with project.html)
    gantt.templates.timeline_cell_class = function (task, date) {
      var classes = []
      var day = date.getDay()
      if (day === 0 || day === 6) {
        classes.push('weekend-cell')
      }
      var today = new Date()
      if (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      ) {
        classes.push('today-cell')
      }
      return classes.join(' ')
    }

    // Highlight today in scale header
    gantt.templates.scale_cell_class = function (date) {
      var today = new Date()
      if (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      ) {
        return 'scale-today'
      }
      return ''
    }

    // Event callbacks
    if (onTaskClick) {
      gantt.attachEvent('onTaskClick', (id) => {
        onTaskClick(gantt.getTask(id))
        return true
      })
    }

    if (onTaskChange) {
      gantt.attachEvent('onAfterTaskUpdate', (id) => {
        onTaskChange(gantt.getTask(id))
      })
    }

    // Built-in task detail popup (on bar click in timeline area)
    if (showPopup) {
      let popupEl = null
      let overlayEl = null
      let lastClickX = 0
      let lastClickY = 0

      container.addEventListener('mousemove', (e) => {
        lastClickX = e.clientX
        lastClickY = e.clientY
      })

      function closePopup() {
        if (popupEl) { popupEl.remove(); popupEl = null }
        if (overlayEl) { overlayEl.remove(); overlayEl = null }
      }

      function showTaskPopup(task) {
        closePopup()

        // Don't show for cycles
        if (task.plane_type === 'cycle') return

        const isModule = task.plane_type === 'module' || task.type === 'project'
        const badge = isModule ? 'Project' : 'Task'
        const badgeClass = isModule ? 'badge-project' : 'badge-task'
        const seqId = task.sequence_id ? (project.toUpperCase() + '-' + task.sequence_id) : ''

        const startStr = formatDate(task.start_date)
        const endStr = formatDate(task.end_date)
        const durationDays = task.duration || 1
        const status = capitalizeStatus(task.status) || (isModule ? 'Planned' : '—')
        const taskName = task.text || ''

        let propsHtml = ''
        propsHtml += '<div class="gantt-task-popup-row"><span class="gantt-task-popup-label">Status</span><span class="gantt-task-popup-value">' + status + '</span></div>'
        if (task.assignee) {
          propsHtml += '<div class="gantt-task-popup-row"><span class="gantt-task-popup-label">' + (isModule ? 'Lead' : 'Assignee') + '</span><span class="gantt-task-popup-value">' + task.assignee + '</span></div>'
        }
        if (task.priority) {
          propsHtml += '<div class="gantt-task-popup-row"><span class="gantt-task-popup-label">Priority</span><span class="gantt-task-popup-value">' + task.priority + '</span></div>'
        }
        propsHtml += '<div class="gantt-task-popup-row"><span class="gantt-task-popup-label">Start</span><span class="gantt-task-popup-value">' + startStr + '</span></div>'
        propsHtml += '<div class="gantt-task-popup-row"><span class="gantt-task-popup-label">' + (isModule ? 'Target' : 'Due') + '</span><span class="gantt-task-popup-value">' + endStr + '</span></div>'
        propsHtml += '<div class="gantt-task-popup-row"><span class="gantt-task-popup-label">Duration</span><span class="gantt-task-popup-value">' + durationDays + ' day' + (durationDays !== 1 ? 's' : '') + '</span></div>'

        // Build Plane link
        let planeLink = ''
        if (planeUrl && workspaceSlug && projectId && task.plane_id) {
          const planeHref = isModule
            ? planeUrl + '/' + workspaceSlug + '/projects/' + projectId + '/modules/' + task.plane_id
            : planeUrl + '/' + workspaceSlug + '/projects/' + projectId + '/issues/' + task.plane_id
          planeLink = '<a href="' + planeHref + '" target="_blank" class="gantt-task-popup-btn btn-plane">View in Plane</a>'
        }

        // Create popup
        popupEl = document.createElement('div')
        popupEl.className = 'gantt-task-popup'
        popupEl.innerHTML = '<div class="gantt-task-popup-header">'
          + '<div class="gantt-task-popup-header-left">'
          + '<span class="gantt-task-popup-badge ' + badgeClass + '">' + badge + '</span>'
          + (seqId ? '<span class="gantt-task-popup-id">' + seqId + '</span>' : '')
          + '</div>'
          + '<button class="gantt-task-popup-close">&times;</button>'
          + '</div>'
          + '<div class="gantt-task-popup-title">' + taskName + '</div>'
          + '<div class="gantt-task-popup-props">' + propsHtml + '</div>'
          + '<div class="gantt-task-popup-actions">'
          + planeLink
          + '<button class="gantt-task-popup-btn btn-close">Close</button>'
          + '</div>'

        // Position
        const viewW = window.innerWidth
        const viewH = window.innerHeight
        let left = Math.min(lastClickX + 10, viewW - 320)
        let top = Math.min(lastClickY + 10, viewH - 300)
        popupEl.style.left = left + 'px'
        popupEl.style.top = top + 'px'

        // Overlay
        overlayEl = document.createElement('div')
        overlayEl.className = 'gantt-task-popup-overlay'
        overlayEl.addEventListener('click', closePopup)

        document.body.appendChild(overlayEl)
        document.body.appendChild(popupEl)

        // Close handlers
        popupEl.querySelector('.gantt-task-popup-close').addEventListener('click', closePopup)
        popupEl.querySelector('.btn-close').addEventListener('click', closePopup)
      }

      gantt.attachEvent('onTaskClick', (id) => {
        const task = gantt.getTask(id)
        // Only show popup for clicks in the timeline area (not grid)
        const gridWidth = gantt.config.grid_width || gantt.$grid_data?.offsetWidth || 300
        const ganttPos = container.getBoundingClientRect()
        const relX = lastClickX - ganttPos.left
        if (relX > gridWidth) {
          showTaskPopup(task)
        }
        if (onTaskClick) onTaskClick(task)
        return true
      })
    } else if (onTaskClick) {
      gantt.attachEvent('onTaskClick', (id) => {
        onTaskClick(gantt.getTask(id))
        return true
      })
    }

    // Preserve user-set type when auto_types would override
    const _storedTypes = {}
    gantt.attachEvent('onTaskLoading', function(task) {
      if (task.type) _storedTypes[task.id] = task.type
      return true
    })
    gantt.attachEvent('onAfterTaskUpdate', function(id) {
      const task = gantt.getTask(id)
      if (_storedTypes[id] === 'project' && task.type !== 'project') {
        task.type = 'project'
        gantt.refreshTask(id)
      }
    })

    // Edit sidebar — replaces the default lightbox
    let sidebar = null
    if (editable) {
      sidebar = createEditSidebar({
        container,
        apiBase,
        project,
        planeUrl,
        workspaceSlug,
        projectId,
      })

      // Override lightbox to open our sidebar instead
      gantt.showLightbox = function(id) {
        const task = gantt.getTask(id)
        sidebar.open(task)
      }
    }

    // Init
    const apiUrl = `${apiBase}/api/projects/${project}`
    gantt.init(container)
    gantt.load(`${apiUrl}/data`, () => {
      gantt.showDate(new Date())
      // Inject Add Task button after data loads
      if (editable) injectAddTaskButton()
    })

    // Add Task button in grid header
    function injectAddTaskButton() {
      const existing = container.querySelector('.gantt-add-task-btn')
      if (existing) existing.remove()
      const nameCell = container.querySelector('.gantt_grid_head_cell')
      if (!nameCell) return
      nameCell.style.position = 'relative'
      nameCell.style.overflow = 'visible'
      const btn = document.createElement('button')
      btn.className = 'gantt-add-task-btn'
      btn.title = 'Add Task'
      btn.textContent = '+'
      btn.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);width:20px;height:20px;border:1px dashed #cbd5e1;border-radius:4px;background:#fff;color:#64748b;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;'
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation()
        e.preventDefault()
        if (sidebar) {
          sidebar.open({
            id: null,
            plane_id: null,
            plane_type: 'issue',
            type: 'task',
            text: '',
            description: '',
            status: 'to do',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            assignee: '',
            priority: '',
            sequence_id: null,
            _isNew: true,
          })
        }
      }, true)
      nameCell.appendChild(btn)
    }

    // Re-inject on render
    gantt.attachEvent('onGanttRender', () => {
      if (editable) setTimeout(injectAddTaskButton, 50)
    })

    // DataProcessor for edits
    if (editable) {
      dpInstance = gantt.createDataProcessor({ url: apiUrl, mode: 'REST' })

      gantt.attachEvent('onRowDragEnd', (id) => {
        const task = gantt.getTask(id)
        const parent = task.parent || 0
        const children = gantt.getChildren(parent)
        const order = children.map((childId, index) => ({ id: childId, sort_order: index }))
        fetch(`${apiUrl}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order),
        })
        return true
      })
    }
  })

  // Return controller
  return {
    setScale(level) {
      if (window.gantt && SCALES[level]) {
        window.gantt.config.scales = SCALES[level]
        window.gantt.render()
      }
    },
    destroy() {
      destroyed = true
      if (dpInstance) dpInstance.destructor()
      if (sidebar) sidebar.destroy()
      if (window.gantt) window.gantt.destructor()
    },
  }
}

/**
 * Inject custom Gantt CSS into the document head (once).
 */
let cssInjected = false
function injectCustomCSS() {
  if (cssInjected) return
  const style = document.createElement('style')
  style.textContent = GANTT_CUSTOM_CSS
  document.head.appendChild(style)
  cssInjected = true
}

/**
 * Ensure DHTMLX Gantt JS + CSS are loaded (from CDN or bundled).
 */
let loadPromise = null
function ensureGanttLoaded() {
  if (window.gantt) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    // Load CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.css'
    document.head.appendChild(link)

    // Load JS
    const script = document.createElement('script')
    script.src = 'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load DHTMLX Gantt'))
    document.head.appendChild(script)
  })

  return loadPromise
}
