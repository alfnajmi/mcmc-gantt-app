/**
 * Core Gantt engine — wraps DHTMLX Gantt, manages lifecycle and API communication.
 * Used by both the Web Component and Vue wrapper.
 */

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
const GANTT_CUSTOM_CSS = `
  .gantt_task_line.gantt_project {
    background: #2563eb !important;
    border-color: #2563eb !important;
    border-radius: 4px;
  }
  .gantt_task_line.gantt_task {
    background: #10b981 !important;
    border-color: #10b981 !important;
    border-radius: 4px;
  }
  .gantt_task_line.milestone_task {
    background: #f59e0b !important;
    border-color: #f59e0b !important;
  }
  .gantt_task_line .gantt_task_progress {
    background: rgba(0,0,0,0.15);
    border-radius: 4px;
  }
  .gantt-today-cell {
    background: rgba(229, 57, 53, 0.08);
    border-left: 2px solid #e53935;
  }
  .gantt_grid_head_cell {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
  }
  .gantt_tree_content {
    font-size: 13px;
  }
  .gantt_row.gantt_project .gantt_tree_content {
    font-weight: 700;
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
    background: rgba(0, 0, 0, 0.3) !important;
    opacity: 1 !important;
  }

  /* --- Confirm/Alert popup --- */
  .gantt_modal_box {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif !important;
    border-radius: 12px !important;
    border: 1px solid #e2e8f0 !important;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12) !important;
    overflow: hidden !important;
    padding: 24px 28px !important;
    background: #fff !important;
    min-width: 400px !important;
  }
  .gantt_popup_title {
    display: none !important;
  }
  .gantt_popup_text {
    font-size: 14px !important;
    color: #1e293b !important;
    padding: 0 0 20px !important;
    margin: 0 !important;
    border: none !important;
    text-align: center !important;
  }
  .gantt_popup_controls {
    display: flex !important;
    justify-content: center !important;
    gap: 8px !important;
    padding: 0 !important;
  }
  .gantt_popup_button {
    border-radius: 6px !important;
    padding: 8px 16px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    font-family: inherit !important;
    border: 1px solid #e2e8f0 !important;
    cursor: pointer !important;
    margin: 0 !important;
    background: #fff !important;
    color: #1e293b !important;
  }
  .gantt_popup_button:hover {
    background: #f8fafc !important;
  }
  .gantt_popup_button.gantt_ok_button {
    background: #dc2626 !important;
    color: #fff !important;
    border-color: #dc2626 !important;
  }
  .gantt_popup_button.gantt_ok_button:hover {
    background: #b91c1c !important;
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

    // Task styling (CSS class per type)
    gantt.templates.task_class = function(start, end, task) {
      if (task.type === 'project') return 'gantt_project'
      if (task.type === 'milestone') return 'milestone_task'
      return 'gantt_task'
    }

    // Today marker
    gantt.templates.timeline_cell_class = function (task, date) {
      const today = new Date()
      if (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      ) {
        return 'gantt-today-cell'
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

    // Init
    const apiUrl = `${apiBase}/api/projects/${project}`
    gantt.init(container)
    gantt.load(`${apiUrl}/data`, () => {
      gantt.showDate(new Date())
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
