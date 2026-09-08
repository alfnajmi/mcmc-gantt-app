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

// A task/project is overdue when its due date is strictly before today and it
// has not been completed. Completed work is never flagged.
//
// The due date is resolved in priority order because the raw task payload does
// not always carry a usable `end_date`:
//   1. plane_target_date — the authoritative Plane due date (YYYY-MM-DD)
//   2. end_date — DHTMLX's computed/explicit end, when present
//   3. start_date + duration — reconstructed exclusive end date
function resolveDueDate(task) {
  if (task.plane_target_date) {
    var pt = new Date(task.plane_target_date)
    if (!isNaN(pt)) return pt
  }
  if (task.end_date) {
    var e = task.end_date instanceof Date ? task.end_date : new Date(task.end_date)
    if (!isNaN(e)) return e
  }
  if (task.start_date && task.duration) {
    var start = task.start_date instanceof Date ? task.start_date : new Date(task.start_date)
    if (!isNaN(start)) {
      var end = new Date(start)
      end.setDate(end.getDate() + Number(task.duration))
      return end
    }
  }
  return null
}

function isTaskOverdue(task) {
  if (!task) return false
  if ((task.status || '').toLowerCase() === 'complete') return false

  var due = resolveDueDate(task)
  if (!due || isNaN(due)) return false

  // Compare on date boundaries so an item due today is not yet "past due".
  var today = new Date()
  var todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  var dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  return dueMidnight < todayMidnight
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

function todayScaleCellClass(date) {
  var today = new Date()
  return date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
    ? 'scale-today scale-today-day'
    : ''
}

function isTodayInScalePeriod(date, unit, step) {
  var today = new Date()
  today.setHours(0, 0, 0, 0)
  var cellStart = new Date(date)
  cellStart.setHours(0, 0, 0, 0)
  var cellEnd = new Date(cellStart)
  var cellStep = step || 1
  if (unit === 'week') cellEnd.setDate(cellEnd.getDate() + 7 * cellStep)
  else if (unit === 'month') cellEnd.setMonth(cellEnd.getMonth() + cellStep)
  else if (unit === 'quarter') cellEnd.setMonth(cellEnd.getMonth() + 3 * cellStep)
  else if (unit === 'year') cellEnd.setFullYear(cellEnd.getFullYear() + cellStep)
  else cellEnd.setDate(cellEnd.getDate() + cellStep)
  return today >= cellStart && today < cellEnd
}

function todayPeriodScaleCellClass(date, unit, step) {
  return isTodayInScalePeriod(date, unit, step)
    ? 'scale-today scale-today-period scale-today-' + unit
    : ''
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SHORT_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ISO-8601 week number (weeks start Monday; week 1 contains the first Thursday).
function getWeekNumber(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  var dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

const SCALES = {
  year: [
    {
      unit: 'year',
      step: 1,
      css: function (date) { return todayPeriodScaleCellClass(date, 'year', 1) },
      format: '%Y',
    },
    {
      unit: 'quarter',
      step: 1,
      css: function (date) { return todayPeriodScaleCellClass(date, 'quarter', 1) },
      format: function (date) {
        return 'Q' + (Math.floor(date.getMonth() / 3) + 1)
      },
    },
  ],
  day: [
    {
      unit: 'day',
      step: 1,
      css: todayScaleCellClass,
      format: function (date) {
        return date.getDate() + ' ' + SHORT_MONTHS[date.getMonth()]
      },
    },
  ],
  week: [
    {
      unit: 'week',
      step: 1,
      css: function (date) { return todayPeriodScaleCellClass(date, 'week', 1) },
      format: function (date) {
        var end = new Date(date)
        end.setDate(end.getDate() + 6)
        return 'W' + getWeekNumber(date) + ' ' + SHORT_MONTHS[date.getMonth()] + ' ' + date.getDate() + ' - ' + end.getDate()
      },
    },
    {
      unit: 'day',
      step: 1,
      css: todayScaleCellClass,
      format: function (date) {
        return SHORT_DAYS[date.getDay()] + ' ' + date.getDate()
      },
    },
  ],
  month: [
    {
      unit: 'month',
      step: 1,
      css: function (date) { return todayPeriodScaleCellClass(date, 'month', 1) },
      format: '%F %Y',
    },
    {
      unit: 'week',
      step: 1,
      css: function (date) { return todayPeriodScaleCellClass(date, 'week', 1) },
      format: function (date) {
        return 'W' + getWeekNumber(date)
      },
    },
  ],
}

const SCALE_LEVELS = ['day', 'week', 'month', 'year']

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
    /* Plane-style row separators belong to the task table only. */
    border-bottom: 1px solid #eef2f7 !important;
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
  /* DHTMLX uses one viewport-sized pseudo row to continue the timeline
     background below the final task. It must never behave like a task. */
  .gantt_task_row[data-task-id="timeline_placeholder_task"],
  .gantt_task_row[data-task-id="timeline_placeholder_task"]:hover,
  .gantt_task_row[data-task-id="timeline_placeholder_task"].hover {
    background-color: transparent !important;
    pointer-events: none !important;
  }
  .gantt_task_row.gantt_selected {
    background: #eff6ff !important;
  }
  .gantt_tree_content {
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
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
  /* Make the resize edges easy to hit so dragging near a bar end does not
     accidentally start DHTMLX's whole-task move mode. */
  .gantt_task_line .gantt_task_drag.task_left,
  .gantt_task_line .gantt_task_drag.task_right {
    width: 14px !important;
    z-index: 12 !important;
    cursor: ew-resize !important;
  }
  .gantt_task_line .gantt_task_drag.task_left { left: -7px !important; }
  .gantt_task_line .gantt_task_drag.task_right { right: -7px !important; }
  .gantt_task_line:hover .gantt_task_drag.task_left::after,
  .gantt_task_line:hover .gantt_task_drag.task_right::after,
  .gantt_task_line.gantt_selected .gantt_task_drag.task_left::after,
  .gantt_task_line.gantt_selected .gantt_task_drag.task_right::after {
    content: '';
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 6px;
    width: 2px;
    border-radius: 1px;
    background: rgba(71, 85, 105, 0.7);
  }
  .gantt_task_line .gantt_task_progress {
    background: rgba(71, 85, 105, 0.12);
    border-radius: 4px;
  }

  /* Keep ordinary task names beside the bar, matching Plane's timeline.
     Position the always-rendered task-content node instead of relying on
     DHTMLX's optional right-side-content renderer. */
  .gantt_task_line.gantt_task .gantt_task_content {
    /* The right dependency handle occupies the first 20px after the bar. */
    left: calc(100% + 26px) !important;
    width: max-content !important;
    min-width: max-content !important;
    color: #334155 !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    line-height: 22px !important;
    white-space: nowrap !important;
    overflow: visible !important;
    text-align: left !important;
    pointer-events: none;
  }

  /* Status-based bar colors */
  .gantt_task_line.gantt_task.status-complete {
    background: #bbf7d0 !important;
    border-color: #86efac !important;
  }
  .gantt_task_line.gantt_task.status-in-progress {
    background: #bfdbfe !important;
    border-color: #93c5fd !important;
  }
  .gantt_task_line.gantt_task.status-planning {
    background: #ddd6fe !important;
    border-color: #c4b5fd !important;
  }
  .gantt_task_line.gantt_task.status-todo {
    background: #e2e8f0 !important;
    border-color: #cbd5e1 !important;
  }

  /* Overdue — past the due date and not complete. Red overrides the
     status color (and the project bar) so slipping work is impossible to miss. */
  .gantt_task_line.gantt-overdue,
  .gantt_task_line.gantt_task.gantt-overdue,
  .gantt_task_line.gantt_project.gantt-overdue {
    background: #fecaca !important;
    border-color: #ef4444 !important;
  }
  .gantt_task_line.gantt-overdue .gantt_task_progress {
    background: rgba(185, 28, 28, 0.18) !important;
  }
  .gantt_task_line.gantt-overdue .gantt_task_content {
    color: #b91c1c !important;
  }

  /* Default task (no status) — light blue */
  .gantt_task_line.gantt_task {
    background: #dbeafe !important;
    border-color: #bfdbfe !important;
    border-radius: 4px;
    overflow: visible !important;
  }

  /* Project bar — green, thin line */
  .gantt_task_line.gantt_project {
    background: #a7f3d0 !important;
    border-color: #6ee7b7 !important;
    border-radius: 4px;
    height: 8px !important;
    margin-top: 12px;
  }

  /* Milestone */
  .gantt_task_line.milestone_task {
    background: #fde68a !important;
    border-color: #fcd34d !important;
  }

  .gantt_task_cell {
    border-right: 1px solid #f1f5f9 !important;
  }

  /* --- Floating timeline zoom controls --- */
  .mcmc-gantt-zoom-controls {
    position: absolute;
    top: 64px;
    right: 16px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 3px 10px rgba(15, 23, 42, 0.12);
  }
  .mcmc-gantt-zoom-button {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: #ffffff;
    color: #475569;
    font: 400 22px/1 -apple-system, "Segoe UI", Roboto, sans-serif;
    cursor: pointer;
  }
  .mcmc-gantt-zoom-button + .mcmc-gantt-zoom-button {
    border-top: 1px solid #e2e8f0;
  }
  .mcmc-gantt-zoom-button:hover:not(:disabled) {
    background: #f8fafc;
    color: #0f172a;
  }
  .mcmc-gantt-zoom-button:focus-visible {
    outline: 2px solid #93c5fd;
    outline-offset: -2px;
  }
  .mcmc-gantt-zoom-button:disabled {
    color: #cbd5e1;
    cursor: default;
  }

  /* --- Weekend striping — diagonal hatched pattern --- */
  .weekend-cell {
    /* Match Plane's sketched weekend columns with a subtle diagonal hatch
       while keeping the timeline light enough for bars and labels to read. */
    background-color: #f8fafc !important;
    background-image: repeating-linear-gradient(
      135deg,
      rgba(148, 163, 184, 0.22) 0,
      rgba(148, 163, 184, 0.22) 1px,
      transparent 1px,
      transparent 4px
    ) !important;
    background-size: 6px 6px !important;
  }
  /* The weekend cell paints its own opaque background over the row, so a
     plain row-hover color would sit behind the hatch. Swap the cell's base
     color to the hover/selected tint on interaction and keep the (semi-
     transparent) hatch on top, so the highlight reads through the sketch. */
  .gantt_task_row:hover .weekend-cell,
  .gantt_task_row.hover .weekend-cell {
    background-color: #f1f5f9 !important;
  }
  .gantt_task_row.gantt_selected .weekend-cell {
    background-color: #eff6ff !important;
  }

  /* Today cells remain available as semantic hooks; the visible indicator is
     one continuous overlay positioned at the current time. */
  .today-cell {
    border-left: 0 !important;
  }
  .mcmc-gantt-today-line {
    position: absolute;
    width: 1px;
    background: #ef4444;
    z-index: 8;
    pointer-events: none;
  }
  .mcmc-gantt-today-line::before {
    content: "";
    position: absolute;
    top: -4px;
    left: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    transform: translateX(-50%);
  }

  /* Today's date highlighted in scale header */
  .gantt_scale_cell.scale-today {
    color: #ffffff !important;
    font-weight: 700 !important;
    position: relative;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='24' viewBox='0 0 220 24'%3E%3Crect width='220' height='24' rx='5' fill='%23ef4444'/%3E%3C/svg%3E") !important;
    background-position: center !important;
    background-size: 220px 24px !important;
    background-repeat: no-repeat !important;
  }
  .gantt_scale_cell.scale-today::after {
    display: none !important;
  }
  /* Compact day labels get their own true pill so the rounded ends remain
     visible instead of showing the clipped center of the wide period SVG. */
  .gantt_scale_cell.scale-today-day {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='38' height='20' viewBox='0 0 38 20'%3E%3Crect width='38' height='20' rx='4' fill='%23ef4444'/%3E%3C/svg%3E") !important;
    background-size: 38px 20px !important;
  }
  /* Keep active period/week labels on the existing wide treatment. */
  .gantt_scale_cell.scale-today-period,
  .gantt_scale_cell.scale-today-week {
    background-size: 220px 24px !important;
  }
  /* The active week label owns its pill so DHTMLX cannot mask the first/last
     characters when it omits the period-specific class from the scale cell. */
  .gantt-scale-today-label {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 8px;
    border-radius: 5px;
    box-sizing: border-box;
    background: #ef4444;
    color: #ffffff;
    line-height: 24px;
    white-space: nowrap;
  }
  /* Month and Year use content-sized pills; Day keeps its dedicated SVG and
     Week keeps the wider full-range label accepted by the UI. */
  .gantt-scale-today-label--compact {
    height: 20px;
    padding: 0 6px;
    border-radius: 4px;
    line-height: 20px;
  }

  /* Hide default marker (using cell border approach instead) */
  .gantt_marker {
    display: none !important;
  }

  /* Add Task button */
  .gantt-add-task-btn:hover {
    background: #f1f5f9 !important;
    border-color: #64748b !important;
    border-style: solid !important;
    color: #334155 !important;
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
 * @param {boolean} [options.showGrid=true] - Show the task table beside the timeline
 * @param {boolean} [options.showZoomControls=false] - Show floating timeline zoom controls
 * @param {number} [options.scaleHeight=64] - Total height of the timeline scale header
 * @param {Function} [options.onTaskClick] - Callback when task is clicked
 * @param {Function} [options.onTaskChange] - Callback when task is updated
 * @param {Function} [options.onScaleChange] - Callback when zoom controls change the scale
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
    showGrid = true,
    showZoomControls = false,
    scaleHeight = 64,
    onTaskClick = null,
    onTaskChange = null,
    onScaleChange = null,
  } = options

  if (!container || !project) {
    throw new Error('mountGantt requires "container" and "project" options.')
  }

  // Dynamically load DHTMLX Gantt if not already loaded
  const ganttReady = ensureGanttLoaded()

  let destroyed = false
  let dpInstance = null
  let sidebar = null
  let zoomControlsEl = null
  let addTaskButton = null
  let addTaskButtonFrame = null
  let addTaskObserver = null
  let todayLineEl = null
  let todayLineCleanup = null
  let todayScaleObserver = null
  let todayScaleLabelFrame = null
  let labelLayoutFrame = null
  let labelLayoutCleanup = null
  let containerResizeObserver = null
  let containerResizeFrame = null
  let gridVisible = showGrid !== false
  let currentScale = SCALES[scale] ? scale : 'month'

  function updateZoomButtons() {
    if (!zoomControlsEl) return
    const index = SCALE_LEVELS.indexOf(currentScale)
    const zoomInButton = zoomControlsEl.querySelector('[data-gantt-zoom="in"]')
    const zoomOutButton = zoomControlsEl.querySelector('[data-gantt-zoom="out"]')
    if (zoomInButton) zoomInButton.disabled = index <= 0
    if (zoomOutButton) zoomOutButton.disabled = index >= SCALE_LEVELS.length - 1
  }

  function setScaleLevel(level, notify = false) {
    if (!SCALES[level]) return false
    currentScale = level
    if (window.gantt && window.gantt.config) {
      window.gantt.config.scales = SCALES[level]
      window.gantt.render()
    }
    updateZoomButtons()
    if (notify && onScaleChange) onScaleChange(level)
    return true
  }

  function zoomBy(direction) {
    const index = SCALE_LEVELS.indexOf(currentScale)
    const nextIndex = Math.max(0, Math.min(SCALE_LEVELS.length - 1, index + direction))
    if (nextIndex !== index) setScaleLevel(SCALE_LEVELS[nextIndex], true)
  }

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
    // A Plane issue with sub-issues is still a Task. Only Plane Modules are
    // Projects, so dhtmlx must not infer project type from child rows.
    gantt.config.auto_types = false
    gantt.config.fit_tasks = true
    gantt.config.row_height = 32
    gantt.config.bar_height = 24
    gantt.config.scale_height = scaleHeight
    // Continue the actual timeline grid and custom cell backgrounds through
    // unused viewport space without creating fake tasks or extra scrolling.
    gantt.config.timeline_placeholder = { height: 0 }
    gantt.config.grid_resize = true
    gantt.config.show_grid = gridVisible
    gantt.config.columns = editable ? EDITABLE_COLUMNS : DEFAULT_COLUMNS
    gantt.config.scales = SCALES[currentScale]

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

      // Overdue alert — bar turns red when the due date has passed and the
      // item is not yet complete, so slipping work stands out at a glance.
      if (isTaskOverdue(task)) classes.push('gantt-overdue')

      return classes.join(' ')
    }

    // Plane-style timeline labels. task_text is used because its DOM node is
    // always rendered; CSS moves that node immediately beyond the task bar.
    gantt.templates.task_text = function(start, end, task) {
      if (task.type === 'project' || task.type === 'milestone') return ''
      return task.text || ''
    }
    gantt.templates.rightside_text = function() {
      return ''
    }

    // Timeline cell styling. Weekend striping only makes sense when each
    // rendered cell represents one day; at broader scales a quarter/month may
    // begin on a weekend, which would incorrectly stripe the entire period.
    // The today marker is computed from the cell's actual span so it lights up
    // at every zoom level (day/week/month/quarter/year), not just day scale.
    gantt.templates.timeline_cell_class = function (task, date) {
      var scales = gantt.config.scales || []
      var bottomScale = scales.length ? scales[scales.length - 1] : { unit: 'day', step: 1 }
      var unit = bottomScale.unit
      var step = bottomScale.step || 1
      var classes = []

      var day = date.getDay()
      if (unit === 'day' && (day === 0 || day === 6)) {
        classes.push('weekend-cell')
      }

      var today = new Date()
      today.setHours(0, 0, 0, 0)
      var cellStart = new Date(date)
      cellStart.setHours(0, 0, 0, 0)
      var cellEnd = new Date(cellStart)
      if (unit === 'day') cellEnd.setDate(cellEnd.getDate() + step)
      else if (unit === 'week') cellEnd.setDate(cellEnd.getDate() + 7 * step)
      else if (unit === 'month') cellEnd.setMonth(cellEnd.getMonth() + step)
      else if (unit === 'quarter') cellEnd.setMonth(cellEnd.getMonth() + 3 * step)
      else if (unit === 'year') cellEnd.setFullYear(cellEnd.getFullYear() + step)
      else cellEnd.setDate(cellEnd.getDate() + 7)

      if (today >= cellStart && today < cellEnd) {
        classes.push('today-cell')
      }

      return classes.join(' ')
    }

    // Highlight today in the scale header. Uses the bottom scale's unit so the
    // red pill lands on the cell that CONTAINS today at every zoom level
    // (day/week/month/quarter/year), not only when a cell is exactly today.
    gantt.templates.scale_cell_class = function (date) {
      var scales = gantt.config.scales || []
      var bottomScale = scales.length ? scales[scales.length - 1] : { unit: 'day', step: 1 }
      var unit = bottomScale.unit
      var step = bottomScale.step || 1

      var today = new Date()
      today.setHours(0, 0, 0, 0)
      var cellStart = new Date(date)
      cellStart.setHours(0, 0, 0, 0)
      var cellEnd = new Date(cellStart)
      if (unit === 'day') cellEnd.setDate(cellEnd.getDate() + step)
      else if (unit === 'week') cellEnd.setDate(cellEnd.getDate() + 7 * step)
      else if (unit === 'month') cellEnd.setMonth(cellEnd.getMonth() + step)
      else if (unit === 'quarter') cellEnd.setMonth(cellEnd.getMonth() + 3 * step)
      else if (unit === 'year') cellEnd.setFullYear(cellEnd.getFullYear() + step)
      else cellEnd.setDate(cellEnd.getDate() + 7)

      return today >= cellStart && today < cellEnd ? 'scale-today' : ''
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
        const gridWidth = gantt.config.show_grid
          ? (gantt.config.grid_width || gantt.$grid_data?.offsetWidth || 300)
          : 0
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
      if (task._ganttExplicitTypeChange) {
        _storedTypes[id] = task.type
        delete task._ganttExplicitTypeChange
        return
      }
      if (_storedTypes[id] === 'project' && task.type !== 'project') {
        task.type = 'project'
        gantt.refreshTask(id)
      }
    })

    // Edit sidebar — replaces the default lightbox
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

    // Plane-style current-time indicator: one uninterrupted line across the
    // viewport, positioned within today's cell using the actual current time.
    function renderTodayLine() {
      if (destroyed) return
      const dataArea = gantt.$task_data || container.querySelector('.gantt_data_area')
      const overlayHost = gantt.$container || container
      if (!dataArea || !overlayHost) return

      if (!todayLineEl || todayLineEl.parentNode !== overlayHost) {
        if (todayLineEl) todayLineEl.remove()
        todayLineEl = document.createElement('div')
        todayLineEl.className = 'mcmc-gantt-today-line'
        todayLineEl.setAttribute('aria-hidden', 'true')
        overlayHost.appendChild(todayLineEl)
      }

      const now = new Date()
      const state = gantt.getState()
      if (!state.min_date || !state.max_date || now < state.min_date || now > state.max_date) {
        todayLineEl.style.display = 'none'
        return
      }

      const hostRect = overlayHost.getBoundingClientRect()
      const dataRect = dataArea.getBoundingClientRect()
      // dataRect.left already reflects DHTMLX's horizontal scroll transform.
      const left = dataRect.left - hostRect.left + gantt.posFromDate(now)
      const dataLeft = dataRect.left - hostRect.left
      const dataRight = dataRect.right - hostRect.left

      if (left < dataLeft || left > dataRight) {
        todayLineEl.style.display = 'none'
        return
      }

      todayLineEl.style.display = ''
      todayLineEl.style.left = `${Math.round(left)}px`
      todayLineEl.style.top = `${Math.round(dataRect.top - hostRect.top)}px`
      todayLineEl.style.height = `${Math.round(dataRect.height)}px`
    }

    // Day keeps its dedicated SVG pill. Week preserves the accepted full
    // ISO-week range label, while Month and Year convert both active scale
    // rows into content-sized pills without synthesizing longer text.
    function applyTodayScaleLabel(cell, label, compact) {
      if (!cell || !label) return

      let pill = cell.querySelector('.gantt-scale-today-label')
      if (!pill) {
        cell.textContent = ''
        pill = document.createElement('span')
        cell.appendChild(pill)
      }
      pill.className = 'gantt-scale-today-label' +
        (compact ? ' gantt-scale-today-label--compact' : '')
      if (pill.textContent !== label) pill.textContent = label
      cell.setAttribute('aria-label', label)
      cell.style.setProperty('background-image', 'none', 'important')
      cell.style.setProperty('overflow', 'visible', 'important')
    }

    function findTodayScaleCell(unit, rowIndex) {
      const specific = container.querySelector('.gantt_scale_cell.scale-today-' + unit)
      if (specific) return specific
      const rows = container.querySelectorAll('.gantt_scale_line')
      return rows[rowIndex]
        ? rows[rowIndex].querySelector('.gantt_scale_cell.scale-today')
        : null
    }

    function decorateTodayScaleLabels() {
      if (destroyed || currentScale === 'day') return

      if (currentScale === 'week') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        const weekPrefix = 'W' + getWeekNumber(today)
        const label = weekPrefix + ' ' + SHORT_MONTHS[weekStart.getMonth()] + ' ' +
          weekStart.getDate() + ' - ' + weekEnd.getDate()
        const cells = Array.from(container.querySelectorAll('.gantt_scale_cell'))
        const cell = cells.find((candidate) => {
          const text = candidate.textContent.replace(/\s+/g, ' ').trim()
          return candidate.classList.contains('scale-today') && /^W\d+\b/.test(text)
        }) || cells.find((candidate) => {
          const text = candidate.textContent.replace(/\s+/g, ' ').trim()
          return text === weekPrefix || text.startsWith(weekPrefix + ' ')
        })
        applyTodayScaleLabel(cell, label, false)
        return
      }

      const units = currentScale === 'month'
        ? ['month', 'week']
        : currentScale === 'year'
          ? ['year', 'quarter']
          : []

      units.forEach((unit, rowIndex) => {
        const cell = findTodayScaleCell(unit, rowIndex)
        if (!cell) return
        const existingPill = cell.querySelector('.gantt-scale-today-label')
        const label = (existingPill ? existingPill.textContent : cell.textContent)
          .replace(/\s+/g, ' ')
          .trim()
        applyTodayScaleLabel(cell, label, true)
      })
    }

    function scheduleTodayScaleLabels() {
      if (todayScaleLabelFrame !== null) return
      todayScaleLabelFrame = window.requestAnimationFrame(() => {
        todayScaleLabelFrame = null
        decorateTodayScaleLabels()
      })
    }

    const scaleHeader = container.querySelector('.gantt_task_scale')
    if (scaleHeader && typeof window.MutationObserver === 'function') {
      todayScaleObserver = new window.MutationObserver(scheduleTodayScaleLabels)
      todayScaleObserver.observe(scaleHeader, { childList: true, subtree: true })
    }

    // Sync hover highlighting between the grid rows and the timeline rows so
    // pointing at either side highlights the same task on both.
    let hoverSyncBound = false
    let lastHoverId = null
    function setupRowHoverSync() {
      if (hoverSyncBound) return
      const gridData = container.querySelector('.gantt_grid_data')
      const taskArea = container.querySelector('.gantt_data_area')
      if (!gridData || !taskArea) return
      hoverSyncBound = true

      function highlightRow(id) {
        if (id === lastHoverId) return
        container
          .querySelectorAll('.gantt_row.hover, .gantt_task_row.hover')
          .forEach((el) => el.classList.remove('hover'))
        lastHoverId = id
        if (!id) return
        const gridRow = gridData.querySelector(`[data-task-id="${id}"]`)
        const taskRow = taskArea.querySelector(`[data-task-id="${id}"]`)
        if (gridRow) gridRow.classList.add('hover')
        if (taskRow) taskRow.classList.add('hover')
      }

      gridData.addEventListener('mouseover', (e) => {
        const row = e.target.closest('.gantt_row')
        highlightRow(row ? row.getAttribute('data-task-id') : null)
      })
      taskArea.addEventListener('mouseover', (e) => {
        const row = e.target.closest('.gantt_task_row')
        highlightRow(row ? row.getAttribute('data-task-id') : null)
      })
      gridData.addEventListener('mouseleave', () => highlightRow(null))
      taskArea.addEventListener('mouseleave', () => highlightRow(null))
    }

    gantt.attachEvent('onGanttRender', () => {
      window.requestAnimationFrame(renderTodayLine)
      scheduleTodayScaleLabels()
      setupRowHoverSync()
    })
    scheduleTodayScaleLabels()
    gantt.attachEvent('onGanttScroll', renderTodayLine)
    window.addEventListener('resize', renderTodayLine)
    todayLineCleanup = () => window.removeEventListener('resize', renderTodayLine)

    // Keep external task labels readable at every zoom level. Labels stay to
    // the right when possible, move inside long visible bars near the viewport
    // edge, and move to the left of short bars when the right side is clipped.
    function layoutTaskLabels() {
      labelLayoutFrame = null
      if (destroyed) return

      const viewport = gantt.$task_data
        || container.querySelector('.gantt_data_area')
        || container.querySelector('.gantt_task')
      if (!viewport) return

      const viewportRect = viewport.getBoundingClientRect()
      const viewportWidth = viewportRect.width
      if (viewportWidth <= 0) return

      const edgePadding = 8
      const handleGap = 26
      const maxLabelWidth = Math.max(0, viewportWidth - edgePadding * 2)

      container.querySelectorAll('.gantt_task_line.gantt_task').forEach((bar) => {
        const content = bar.querySelector('.gantt_task_content')
        if (!content || !content.textContent.trim()) return

        // Restore the default outside-right layout before measuring.
        content.style.removeProperty('left')
        content.style.removeProperty('width')
        content.style.removeProperty('min-width')
        content.style.removeProperty('max-width')
        content.style.removeProperty('overflow')
        content.style.removeProperty('text-overflow')
        delete content.dataset.labelPlacement

        const barRect = bar.getBoundingClientRect()
        if (barRect.right < viewportRect.left || barRect.left > viewportRect.right) return

        let labelWidth = Math.ceil(content.getBoundingClientRect().width || content.scrollWidth)
        const labelText = content.textContent.trim()
        content.title = labelText

        // Only truncate when the full label is wider than the timeline itself;
        // the title still exposes the complete task name in that edge case.
        if (labelWidth > maxLabelWidth) {
          labelWidth = maxLabelWidth
          content.style.setProperty('width', `${maxLabelWidth}px`, 'important')
          content.style.setProperty('min-width', '0', 'important')
          content.style.setProperty('max-width', `${maxLabelWidth}px`, 'important')
          content.style.setProperty('overflow', 'hidden', 'important')
          content.style.setProperty('text-overflow', 'ellipsis', 'important')
        }

        const rightX = barRect.right + handleGap
        if (rightX + labelWidth <= viewportRect.right - edgePadding) {
          content.dataset.labelPlacement = 'right'
          return
        }

        const visibleLeft = Math.max(barRect.left, viewportRect.left)
        const visibleRight = Math.min(barRect.right, viewportRect.right)
        const visibleWidth = Math.max(0, visibleRight - visibleLeft)

        if (visibleWidth >= labelWidth + edgePadding * 2) {
          const insideX = visibleRight - labelWidth - edgePadding
          content.style.setProperty('left', `${insideX - barRect.left}px`, 'important')
          content.dataset.labelPlacement = 'inside'
          return
        }

        const leftX = barRect.left - handleGap - labelWidth
        if (leftX >= viewportRect.left + edgePadding) {
          content.style.setProperty('left', `${leftX - barRect.left}px`, 'important')
          content.dataset.labelPlacement = 'left'
          return
        }

        // Last resort for a very narrow visible bar: pin the complete label to
        // the nearest safe position inside the timeline viewport.
        const pinnedX = Math.max(
          viewportRect.left + edgePadding,
          Math.min(viewportRect.right - labelWidth - edgePadding, visibleLeft + edgePadding),
        )
        content.style.setProperty('left', `${pinnedX - barRect.left}px`, 'important')
        content.dataset.labelPlacement = 'pinned'
      })
    }

    function scheduleTaskLabelLayout() {
      if (labelLayoutFrame !== null || destroyed) return
      labelLayoutFrame = window.requestAnimationFrame(layoutTaskLabels)
    }

    gantt.attachEvent('onGanttRender', scheduleTaskLabelLayout)
    gantt.attachEvent('onGanttScroll', scheduleTaskLabelLayout)
    window.addEventListener('resize', scheduleTaskLabelLayout)

    let labelResizeObserver = null
    if (typeof window.ResizeObserver === 'function') {
      const viewport = gantt.$task_data || container.querySelector('.gantt_task')
      if (viewport) {
        labelResizeObserver = new window.ResizeObserver(scheduleTaskLabelLayout)
        labelResizeObserver.observe(viewport)
      }
    }

    labelLayoutCleanup = () => {
      window.removeEventListener('resize', scheduleTaskLabelLayout)
      if (labelResizeObserver) labelResizeObserver.disconnect()
      if (labelLayoutFrame !== null) {
        window.cancelAnimationFrame(labelLayoutFrame)
        labelLayoutFrame = null
      }
    }

    // DHTMLX calculates its internal grid/timeline widths at initialization.
    // Parent-only width changes (for example a collapsing navigation sidebar)
    // do not trigger a window resize, so observe the mount container directly
    // and keep DHTMLX synchronized throughout the CSS transition.
    if (typeof window.ResizeObserver === 'function') {
      let lastContainerWidth = Math.round(container.getBoundingClientRect().width)
      let lastContainerHeight = Math.round(container.getBoundingClientRect().height)

      containerResizeObserver = new window.ResizeObserver((entries) => {
        if (destroyed) return
        const rect = entries[0]?.contentRect
        if (!rect) return
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)
        if (width === lastContainerWidth && height === lastContainerHeight) return
        lastContainerWidth = width
        lastContainerHeight = height
        if (containerResizeFrame !== null) return

        containerResizeFrame = window.requestAnimationFrame(() => {
          containerResizeFrame = null
          if (destroyed || window.gantt !== gantt) return
          const scroll = gantt.getScrollState ? gantt.getScrollState() : null
          if (typeof gantt.setSizes === 'function') gantt.setSizes()
          else gantt.render()
          if (scroll && gantt.scrollTo) gantt.scrollTo(scroll.x, scroll.y)
          scheduleTaskLabelLayout()
          renderTodayLine()
        })
      })
      containerResizeObserver.observe(container)
    }

    if (showZoomControls) {
      zoomControlsEl = document.createElement('div')
      zoomControlsEl.className = 'mcmc-gantt-zoom-controls'
      zoomControlsEl.setAttribute('role', 'group')
      zoomControlsEl.setAttribute('aria-label', 'Timeline zoom')
      zoomControlsEl.innerHTML = '<button type="button" class="mcmc-gantt-zoom-button" data-gantt-zoom="in" aria-label="Zoom in" title="Zoom in">+</button>'
        + '<button type="button" class="mcmc-gantt-zoom-button" data-gantt-zoom="out" aria-label="Zoom out" title="Zoom out">&minus;</button>'
      zoomControlsEl.addEventListener('mousedown', (event) => event.stopPropagation())
      zoomControlsEl.addEventListener('click', (event) => {
        event.stopPropagation()
        const button = event.target.closest('[data-gantt-zoom]')
        if (!button || button.disabled) return
        zoomBy(button.dataset.ganttZoom === 'in' ? -1 : 1)
      })
      container.appendChild(zoomControlsEl)
      updateZoomButtons()
    }

    gantt.load(`${apiUrl}/data`, () => {
      gantt.showDate(new Date())
      scheduleTaskLabelLayout()
      renderTodayLine()
      // Ensure Add Task is attached after data/header rendering settles.
      if (editable) scheduleAddTaskButton()
    })

    // Add Task button in grid header. DHTMLX owns and may replace the header
    // cell during renders, so retain one button and reattach it to the current
    // live cell instead of creating a new node or trusting a stale subtree.
    function ensureAddTaskButton() {
      if (destroyed || !editable || window.gantt !== gantt) return
      const nameCell = container.querySelector('.gantt_grid_head_cell')
      if (!nameCell) return

      nameCell.style.position = 'relative'
      nameCell.style.overflow = 'visible'

      if (!addTaskButton) {
        addTaskButton = document.createElement('button')
        addTaskButton.type = 'button'
        addTaskButton.className = 'gantt-add-task-btn'
        addTaskButton.title = 'Add Task'
        addTaskButton.setAttribute('aria-label', 'Add Task')
        addTaskButton.textContent = '+'
        addTaskButton.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);width:20px;height:20px;border:1px dashed #cbd5e1;border-radius:4px;background:#fff;color:#64748b;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;transition:all 0.12s;'
        addTaskButton.addEventListener('mousedown', (event) => {
          event.stopPropagation()
          event.preventDefault()
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
      }

      if (addTaskButton.parentNode !== nameCell) {
        nameCell.appendChild(addTaskButton)
      }
    }

    function scheduleAddTaskButton() {
      if (destroyed || !editable || addTaskButtonFrame !== null) return
      addTaskButtonFrame = window.requestAnimationFrame(() => {
        addTaskButtonFrame = null
        ensureAddTaskButton()
      })
    }

    // Reattach after every full render; repeated calls are coalesced and safe.
    gantt.attachEvent('onGanttRender', scheduleAddTaskButton)

    // DHTMLX can replace the grid header after its render/drag callbacks have
    // already completed. Observe the owned DOM and recover whenever the
    // retained button is no longer attached to the current live header cell.
    if (typeof window.MutationObserver === 'function') {
      addTaskObserver = new window.MutationObserver(() => {
        if (destroyed || !editable) return
        const liveNameCell = container.querySelector('.gantt_grid_head_cell')
        if (!liveNameCell || addTaskButton?.parentNode === liveNameCell) return
        scheduleAddTaskButton()
      })
      addTaskObserver.observe(container, { childList: true, subtree: true })
    }

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

      // Persist bar move/resize back to Plane and keep the open editor synced.
      // Ignore progress/link drags: they do not change the date range.
      gantt.attachEvent('onAfterTaskDrag', (id, mode) => {
        // Drag/resize can replace the grid header after the render event; use
        // the deterministic drag-completion event to restore Add Task too.
        scheduleAddTaskButton()
        if (mode !== 'move' && mode !== 'resize') return

        const task = gantt.getTask(id)
        if (!task || !task.plane_id || task.plane_type !== 'issue') return
        const start = task.start_date instanceof Date ? task.start_date : new Date(task.start_date)
        if (isNaN(start)) return
        const end = new Date(start)
        end.setDate(end.getDate() + (task.duration || 1))
        const fmt = (date) =>
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        const startDate = fmt(start)
        const endDate = fmt(end)

        // The sidebar owns a cloned task, so update both the live Plane fields
        // and that clone immediately instead of waiting for a full data reload.
        task.plane_start_date = startDate
        task.plane_target_date = endDate
        if (sidebar) sidebar.updateDates(id, startDate, endDate)

        fetch(`${apiUrl}/issues/${task.plane_id}/dates`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: startDate, target_date: endDate }),
        }).then((response) => {
          if (!response.ok) throw new Error(`Failed to persist task dates (${response.status})`)
        }).catch((error) => console.error('Failed to persist task dates to Plane:', error))
      })
    }
  })

  // Return controller
  return {
    setGridVisible(visible) {
      gridVisible = visible !== false
      if (window.gantt && window.gantt.config) {
        const gantt = window.gantt
        const scroll = gantt.getScrollState ? gantt.getScrollState() : null
        gantt.config.show_grid = gridVisible
        gantt.render()

        if (scroll && gantt.scrollTo) {
          const restoreScroll = () => {
            if (!destroyed && window.gantt === gantt) {
              gantt.scrollTo(scroll.x, scroll.y)
            }
          }
          if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(restoreScroll)
          } else {
            setTimeout(restoreScroll, 0)
          }
        }
      }
    },
    setScale(level) {
      setScaleLevel(level)
    },
    zoomIn() {
      zoomBy(-1)
    },
    zoomOut() {
      zoomBy(1)
    },
    destroy() {
      destroyed = true
      if (dpInstance) dpInstance.destructor()
      if (sidebar) sidebar.destroy()
      if (zoomControlsEl) zoomControlsEl.remove()
      if (addTaskObserver) {
        addTaskObserver.disconnect()
        addTaskObserver = null
      }
      if (addTaskButtonFrame !== null) {
        window.cancelAnimationFrame(addTaskButtonFrame)
        addTaskButtonFrame = null
      }
      if (addTaskButton) {
        addTaskButton.remove()
        addTaskButton = null
      }
      if (todayLineEl) todayLineEl.remove()
      if (todayLineCleanup) todayLineCleanup()
      if (todayScaleObserver) todayScaleObserver.disconnect()
      if (todayScaleLabelFrame !== null) {
        window.cancelAnimationFrame(todayScaleLabelFrame)
        todayScaleLabelFrame = null
      }
      if (labelLayoutCleanup) labelLayoutCleanup()
      if (containerResizeObserver) containerResizeObserver.disconnect()
      if (containerResizeFrame !== null) {
        window.cancelAnimationFrame(containerResizeFrame)
        containerResizeFrame = null
      }
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
