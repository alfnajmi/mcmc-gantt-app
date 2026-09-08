/**
 * Edit Sidebar — built-in task/project editor for the Gantt SDK.
 *
 * Features:
 * - Custom type dropdown (Task, Milestone, Project)
 * - Custom status dropdown with color indicators
 * - Inline mini calendar for date picking
 * - Description textarea
 * - Resizable sidebar width (drag left edge)
 * - "Open in Plane" link
 * - Assignee/Priority display (or "Empty" → edit in Plane)
 *
 * All rendering is vanilla DOM — no framework dependency.
 */

const SIDEBAR_CSS = `
.gantt-sidebar-overlay {
  position: absolute;
  inset: 0;
  z-index: 90;
}
.gantt-sidebar {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  min-width: 360px;
  background: #fff;
  border-left: 1px solid #e2e8f0;
  box-shadow: -4px 0 16px rgba(0,0,0,0.06);
  z-index: 95;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  font-size: 13px;
  animation: gantt-slide-in 0.2s ease;
}
@keyframes gantt-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.gantt-sidebar-resize {
  position: absolute;
  top: 0;
  left: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 96;
}
.gantt-sidebar-resize:hover { background: #c7d2fe; }
.gantt-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
}
.gantt-sidebar-header-left {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}
.gantt-sidebar-id {
  min-width: 0;
  max-width: 180px;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
}
.gantt-sidebar-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}
.gantt-sidebar-icon-btn:hover {
  background: #f1f5f9;
  color: #475569;
}
.gantt-sidebar-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 2px;
}
.gantt-sidebar-more-wrap { position: relative; }
.gantt-sidebar-more-menu {
  position: absolute;
  top: 32px;
  right: 0;
  z-index: 210;
  width: 170px;
  padding: 5px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .14);
}
.gantt-sidebar-more-menu[hidden] { display: none; }
.gantt-sidebar-more-item {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #b91c1c;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.gantt-sidebar-more-item:hover { background: #fef2f2; }
/* Type dropdown */
.gantt-type-btn {
  flex: 0 0 auto !important;
  display: inline-flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: center;
  width: max-content !important;
  min-width: max-content !important;
  white-space: nowrap !important;
  word-break: keep-all !important;
  overflow-wrap: normal !important;
  position: relative;
  gap: 5px;
  padding: 4px 24px 4px 26px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}
.gantt-type-btn::before,
.gantt-type-btn::after {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  line-height: 1;
  pointer-events: none;
}
.gantt-type-btn::before { content: attr(data-icon); left: 10px; }
.gantt-type-btn::after { content: '▾'; right: 9px; }
.gantt-type-btn:hover { background: #f1f5f9; }
/* Dropdown menu (shared) */
.gantt-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 150px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  z-index: 200;
  padding: 4px;
}
.gantt-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  text-align: left;
}
.gantt-dropdown-item:hover { background: #f8fafc; }
.gantt-dropdown-item.active { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
.gantt-dropdown-item .check { margin-left: auto; color: #2563eb; }
/* Name */
.gantt-sidebar-name {
  padding: 16px 16px 8px;
}
.gantt-sidebar-name input {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: none;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  outline: none;
  background: transparent;
  font-family: inherit;
}
.gantt-sidebar-name input::placeholder { color: #cbd5e1; }
/* Props */
.gantt-sidebar-props {
  padding: 8px 16px;
  flex: 1;
}
.gantt-prop-row {
  display: flex;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid #f8fafc;
}
.gantt-prop-label {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 110px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  flex-shrink: 0;
}
.gantt-prop-label svg { opacity: 0.6; }
.gantt-prop-value {
  flex: 1;
  font-size: 12px;
  position: relative;
}
.gantt-prop-empty {
  color: #cbd5e1;
  cursor: pointer;
  font-style: italic;
}
.gantt-prop-empty:hover { color: #475569; }
.gantt-prop-empty-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px dashed #e2e8f0;
  border-radius: 5px;
  background: transparent;
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  cursor: pointer;
  font-family: inherit;
}
.gantt-prop-empty-btn:hover {
  border-color: #64748b;
  color: #334155;
  background: #f1f5f9;
}
.gantt-status-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  background: #fff;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}
.gantt-status-btn:hover { background: #f8fafc; }
.gantt-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
/* Dates inline */
.gantt-dates-inline {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.gantt-date-chip {
  flex: 0 0 auto;
  white-space: nowrap;
  padding: 3px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  background: #fff;
  font-size: 11px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
}
.gantt-date-chip:hover, .gantt-date-chip.active {
  border-color: #64748b;
  background: #f1f5f9;
  color: #334155;
}
.gantt-date-sep { color: #cbd5e1; font-size: 11px; }
/* Calendar */
.gantt-mini-cal {
  margin: 8px 0;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}
.gantt-mini-cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.gantt-mini-cal-month { font-size: 13px; font-weight: 600; color: #1e293b; }
.gantt-mini-cal-nav {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 4px; background: transparent;
  color: #64748b; cursor: pointer; font-size: 12px;
}
.gantt-mini-cal-nav:hover { background: #f1f5f9; }
.gantt-mini-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  text-align: center;
}
.gantt-mini-cal-dow {
  font-size: 10px; font-weight: 600; color: #94a3b8; padding: 4px 0;
}
.gantt-mini-cal-day {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto;
  border: none; border-radius: 50%;
  background: transparent;
  font-size: 12px; color: #475569; cursor: pointer;
}
.gantt-mini-cal-day:hover { background: #f1f5f9; }
.gantt-mini-cal-day.other { color: #e2e8f0; }
.gantt-mini-cal-day.today { background: #fee2e2; color: #dc2626; font-weight: 700; }
.gantt-mini-cal-day.selected { background: #2563eb; color: #fff; font-weight: 600; }
.gantt-mini-cal-day.selected:hover { background: #1d4ed8; }
/* Description */
.gantt-sidebar-desc {
  padding: 0 16px 12px;
}
.gantt-sidebar-desc textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  color: #475569;
  background: #f8fafc;
  resize: vertical;
  min-height: 56px;
  line-height: 1.5;
  outline: none;
}
.gantt-sidebar-desc textarea:focus {
  border-color: #818cf8;
  background: #fff;
}
.gantt-sidebar-desc textarea::placeholder { color: #cbd5e1; }
/* Footer */
.gantt-sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.gantt-sidebar-footer button {
  padding: 6px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: #fff;
  color: #64748b;
  font-family: inherit;
}
.gantt-sidebar-footer button:hover { background: #f8fafc; }
.gantt-sidebar-footer .spacer { flex: 1; }
.gantt-sidebar-footer button.delete {
  color: #b91c1c;
  border-color: #fecaca;
  background: #fff7f7;
}
.gantt-sidebar-footer button.delete:hover { background: #fee2e2; }
.gantt-sidebar-footer button.save {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.gantt-sidebar-footer button.save:hover { background: #1d4ed8; }
.gantt-sidebar-footer button.save:disabled { opacity: 0.6; cursor: not-allowed; }
.gantt-trash-toast {
  position: absolute;
  left: 20px;
  bottom: 20px;
  z-index: 220;
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 280px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  color: #1e293b;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
  font-size: 13px;
  font-weight: 600;
}
.gantt-trash-toast button {
  margin-left: auto;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 5px 10px;
  background: #fff;
  color: #2563eb;
  font: inherit;
  cursor: pointer;
}
.gantt-trash-toast button:hover { background: #eff6ff; }
`

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DOWS = ['Su','Mo','Tu','We','Th','Fr','Sa']

const TYPE_OPTIONS = [
  { value: 'task', label: 'Task', icon: '○' },
  { value: 'milestone', label: 'Milestone', icon: '◆' },
  { value: 'project', label: 'Project', icon: '▬' },
]

const STATUS_OPTIONS = [
  { value: 'to do', label: 'To Do', color: '#94a3b8' },
  { value: 'planning', label: 'Planning', color: '#a78bfa' },
  { value: 'in progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'complete', label: 'Complete', color: '#22c55e' },
]

function fmtDate(str) {
  if (!str) return ''
  const d = new Date(str)
  if (isNaN(d)) return str
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function descriptionToText(value) {
  if (!value) return ''
  const text = String(value)
  if (!text.includes('<') || !text.includes('>')) return text
  const wrapper = document.createElement('div')
  wrapper.innerHTML = text
  wrapper.querySelectorAll('br').forEach(node => node.replaceWith('\n'))
  wrapper.querySelectorAll('p, div, li').forEach(node => node.append('\n'))
  return (wrapper.textContent || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

/**
 * Create and manage the edit sidebar.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.container - The gantt wrapper element
 * @param {string} opts.apiBase - API base URL
 * @param {string} opts.project - Project slug
 * @param {string} opts.planeUrl - Plane base URL
 * @param {string} opts.workspaceSlug - Plane workspace
 * @param {string} opts.projectId - Plane project UUID
 * @returns {Object} sidebar controller { open(task), close(), destroy() }
 */
export function createEditSidebar(opts) {
  const { container, apiBase, project, planeUrl, workspaceSlug, projectId, getGantt } = opts
  let el = null
  let overlay = null
  let width = 360
  let task = null
  let calField = null // 'start' | 'end' | null
  let calDate = new Date()
  let toast = null
  let toastTimer = null

  // Inject CSS once
  if (!document.querySelector('#gantt-sidebar-css')) {
    const style = document.createElement('style')
    style.id = 'gantt-sidebar-css'
    style.textContent = SIDEBAR_CSS
    document.head.appendChild(style)
  }

  function open(t) {
    close()
    task = { ...t }
    task.start_date = task.plane_start_date || task.start_date
    task.end_date = task.plane_target_date || task.end_date
    task.text = task.text || ''
    task.type = task.type || 'task'
    task.status = task.status || 'to do'
    task.description = descriptionToText(task.description)
    calField = null
    render()
  }

  function close() {
    removeElements()
    task = null
  }

  function removeElements() {
    if (el) { el.remove(); el = null }
    if (overlay) { overlay.remove(); overlay = null }
  }

  function render() {
    if (!task) return
    removeElements()

    // Overlay
    overlay = document.createElement('div')
    overlay.className = 'gantt-sidebar-overlay'
    overlay.onclick = close

    // Sidebar
    el = document.createElement('div')
    el.className = 'gantt-sidebar'
    el.style.width = width + 'px'
    el.innerHTML = buildHTML()

    container.style.position = 'relative'
    container.appendChild(overlay)
    container.appendChild(el)

    // Wire events
    wireEvents()
  }

  function buildHTML() {
    const typeOpt = TYPE_OPTIONS.find(t => t.value === task.type) || TYPE_OPTIONS[0]
    const statusOpt = STATUS_OPTIONS.find(s => s.value === task.status) || STATUS_OPTIONS[0]
    const seqId = task.sequence_id ? `<span class="gantt-sidebar-id">${project.toUpperCase()}-${task.sequence_id}</span>` : ''

    let calHTML = ''
    if (calField) {
      calHTML = buildCalendarHTML()
    }

    return `
      <div class="gantt-sidebar-resize" data-action="resize"></div>
      <div class="gantt-sidebar-header">
        <div class="gantt-sidebar-header-left">
          <div style="position:relative;flex:0 0 auto">
            <button class="gantt-type-btn" style="display:inline-flex!important;align-items:center!important;min-width:78px!important;white-space:nowrap!important;word-break:keep-all!important;overflow-wrap:normal!important;writing-mode:horizontal-tb!important;direction:ltr!important" data-icon="${typeOpt.icon}" data-action="toggle-type">${typeOpt.label}</button>
          </div>
          ${seqId}
        </div>
        <div class="gantt-sidebar-actions">
          ${planeUrl ? `<button class="gantt-sidebar-icon-btn" data-action="open-plane" title="Open in Plane">↗</button>` : ''}
          ${task._isNew ? '' : `
            <div class="gantt-sidebar-more-wrap">
              <button class="gantt-sidebar-icon-btn" data-action="toggle-actions" title="More actions" aria-label="More actions">•••</button>
              <div class="gantt-sidebar-more-menu" data-actions-menu hidden>
                <button class="gantt-sidebar-more-item" data-action="delete">Delete</button>
              </div>
            </div>
          `}
          <button class="gantt-sidebar-icon-btn" data-action="close">✕</button>
        </div>
      </div>
      <div class="gantt-sidebar-name">
        <input type="text" value="${escHtml(task.text)}" data-field="text" placeholder="Untitled" />
      </div>
      <div class="gantt-sidebar-props">
        <div class="gantt-prop-row">
          <div class="gantt-prop-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>Status</div>
          <div class="gantt-prop-value" style="position:relative">
            <button class="gantt-status-btn" data-action="toggle-status">
              <span class="gantt-status-dot" style="background:${statusOpt.color}"></span>
              ${statusOpt.label} ▾
            </button>
          </div>
        </div>
        <div class="gantt-prop-row">
          <div class="gantt-prop-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Assignees</div>
          <div class="gantt-prop-value">${task.assignee ? `<span>${escHtml(task.assignee)}</span>` : `<button class="gantt-prop-empty-btn" data-action="open-plane">↗ Add in Plane</button>`}</div>
        </div>
        <div class="gantt-prop-row">
          <div class="gantt-prop-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>Dates</div>
          <div class="gantt-prop-value">
            <div class="gantt-dates-inline">
              <button class="gantt-date-chip ${calField === 'start' ? 'active' : ''}" data-action="pick-start">${task.start_date ? fmtDate(task.start_date) : 'Start'}</button>
              <span class="gantt-date-sep">→</span>
              <button class="gantt-date-chip ${calField === 'end' ? 'active' : ''}" data-action="pick-end">${task.end_date ? fmtDate(task.end_date) : 'Due'}</button>
            </div>
          </div>
        </div>
        ${calHTML}
        <div class="gantt-prop-row">
          <div class="gantt-prop-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>Priority</div>
          <div class="gantt-prop-value">${task.priority ? `<span>${escHtml(task.priority)}</span>` : `<button class="gantt-prop-empty-btn" data-action="open-plane">↗ Add in Plane</button>`}</div>
        </div>
      </div>
      <div class="gantt-sidebar-desc">
        <textarea data-field="description" placeholder="Add description..." rows="3">${escHtml(task.description)}</textarea>
      </div>
      <div class="gantt-sidebar-footer">
        <span class="spacer"></span>
        <button data-action="close">Cancel</button>
        <button class="save" data-action="save">Save</button>
      </div>
    `
  }

  function buildCalendarHTML() {
    const year = calDate.getFullYear()
    const month = calDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date(); today.setHours(0,0,0,0)
    const selStr = calField === 'start' ? task.start_date : task.end_date
    const prevDays = new Date(year, month, 0).getDate()

    let daysHTML = DOWS.map(d => `<span class="gantt-mini-cal-dow">${d}</span>`).join('')

    for (let i = firstDay - 1; i >= 0; i--) {
      daysHTML += `<button class="gantt-mini-cal-day other">${prevDays - i}</button>`
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`
      const isToday = new Date(year,month,i).getTime() === today.getTime()
      const isSel = ds === selStr
      let cls = 'gantt-mini-cal-day'
      if (isToday) cls += ' today'
      if (isSel) cls += ' selected'
      daysHTML += `<button class="${cls}" data-date="${ds}">${i}</button>`
    }
    const rem = 42 - (firstDay + daysInMonth)
    for (let i = 1; i <= rem; i++) {
      daysHTML += `<button class="gantt-mini-cal-day other">${i}</button>`
    }

    return `
      <div class="gantt-mini-cal">
        <div class="gantt-mini-cal-header">
          <button class="gantt-mini-cal-nav" data-action="cal-prev">&lt;</button>
          <span class="gantt-mini-cal-month">${MONTHS[month]} ${year}</span>
          <button class="gantt-mini-cal-nav" data-action="cal-next">&gt;</button>
        </div>
        <div class="gantt-mini-cal-grid">${daysHTML}</div>
      </div>
    `
  }

  function wireEvents() {
    if (!el) return

    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]')
      if (!btn) return
      const action = btn.dataset.action

      if (action === 'close') close()
      else if (action === 'open-plane') openInPlane()
      else if (action === 'toggle-actions') {
        const menu = el.querySelector('[data-actions-menu]')
        if (menu) menu.hidden = !menu.hidden
      }
      else if (action === 'toggle-type') showDropdown('type', btn)
      else if (action === 'toggle-status') showDropdown('status', btn)
      else if (action === 'pick-start') { calField = calField === 'start' ? null : 'start'; calDate = task.start_date ? new Date(task.start_date) : new Date(); render() }
      else if (action === 'pick-end') { calField = calField === 'end' ? null : 'end'; calDate = task.end_date ? new Date(task.end_date) : new Date(); render() }
      else if (action === 'cal-prev') { calDate.setMonth(calDate.getMonth() - 1); render() }
      else if (action === 'cal-next') { calDate.setMonth(calDate.getMonth() + 1); render() }
      else if (action === 'delete') deleteItem()
      else if (action === 'save') save()
    })

    // Calendar day click
    el.addEventListener('click', (e) => {
      const dayBtn = e.target.closest('[data-date]')
      if (!dayBtn) return
      const dateStr = dayBtn.dataset.date
      if (calField === 'start') task.start_date = dateStr
      else if (calField === 'end') task.end_date = dateStr
      calField = null
      render()
    })

    // Input binding
    el.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('input', (e) => {
        task[e.target.dataset.field] = e.target.value
      })
    })

    // Resize handle
    const resizeHandle = el.querySelector('[data-action="resize"]')
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault()
        const startX = e.clientX
        const startW = width
        function onMove(ev) { width = Math.max(360, Math.min(600, startW + (startX - ev.clientX))); el.style.width = width + 'px' }
        function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      })
    }
  }

  function showDropdown(type, trigger) {
    // Remove existing dropdown
    const existing = el.querySelector('.gantt-dropdown-menu')
    if (existing) { existing.remove(); return }

    const options = type === 'type'
      ? (task.plane_type === 'module' ? TYPE_OPTIONS.filter(opt => opt.value === 'project') : TYPE_OPTIONS)
      : STATUS_OPTIONS
    const currentVal = type === 'type' ? task.type : task.status

    const menu = document.createElement('div')
    menu.className = 'gantt-dropdown-menu'
    options.forEach(opt => {
      const item = document.createElement('button')
      item.className = 'gantt-dropdown-item' + (opt.value === currentVal ? ' active' : '')
      if (type === 'status') {
        item.innerHTML = `<span class="gantt-status-dot" style="background:${opt.color}"></span>${opt.label}${opt.value === currentVal ? '<span class="check">✓</span>' : ''}`
      } else {
        item.innerHTML = `${opt.icon} ${opt.label}${opt.value === currentVal ? '<span class="check">✓</span>' : ''}`
      }
      item.onclick = (e) => {
        e.stopPropagation()
        if (type === 'type') {
          task.type = opt.value
          // Milestone: auto-set end date = start date
          if (opt.value === 'milestone' && task.start_date) {
            task.end_date = task.start_date
          }
        }
        else task.status = opt.value
        render()
      }
      menu.appendChild(item)
    })

    trigger.parentElement.appendChild(menu)

    // Close on any click outside the menu
    function closeHandler(e) {
      if (!menu.contains(e.target)) {
        menu.remove()
        document.removeEventListener('mousedown', closeHandler, true)
      }
    }
    // Use mousedown + capture to fire before the button's click
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', closeHandler, true)
    })
  }

  function openInPlane() {
    if (!planeUrl || !workspaceSlug || !projectId || !task) return
    const isModule = task.plane_type === 'module'
    const url = isModule
      ? `${planeUrl}/${workspaceSlug}/projects/${projectId}/modules/${task.plane_id}`
      : `${planeUrl}/${workspaceSlug}/projects/${projectId}/issues/${task.plane_id}`
    window.open(url, '_blank')
  }

  function reloadGantt() {
    const gantt = typeof getGantt === 'function' ? getGantt() : window.gantt
    if (!gantt) return
    gantt.clearAll()
    gantt.load(`${apiBase}/api/projects/${project}/data?bypass_cache=true`)
  }

  function showTrashToast(record) {
    if (toast) toast.remove()
    if (toastTimer) clearTimeout(toastTimer)
    toast = document.createElement('div')
    toast.className = 'gantt-trash-toast'
    toast.innerHTML = `<span>${escHtml(record.gantt_type === 'project' ? 'Project' : record.gantt_type === 'milestone' ? 'Milestone' : 'Task')} moved to Trash.</span><button type="button">Undo</button>`
    container.appendChild(toast)
    toast.querySelector('button').onclick = async () => {
      const button = toast.querySelector('button')
      button.disabled = true
      button.textContent = 'Restoring...'
      try {
        const resp = await fetch(
          `${apiBase}/api/projects/${project}/trash/${record.entity_type}/${record.entity_id}/restore`,
          { method: 'POST' },
        )
        if (!resp.ok) throw new Error(await responseErrorMessage(resp, 'Failed to restore item'))
        toast.remove()
        toast = null
        reloadGantt()
      } catch (err) {
        button.disabled = false
        button.textContent = 'Undo'
        window.alert(err.message || 'The item could not be restored.')
      }
    }
    toastTimer = setTimeout(() => {
      if (toast) toast.remove()
      toast = null
    }, 10000)
  }

  async function responseErrorMessage(response, fallback) {
    try {
      const body = await response.json()
      const detail = body && body.detail
      if (typeof detail === 'string' && detail.trim()) return detail
      if (detail) return JSON.stringify(detail)
    } catch {
      // Use the fallback when the API response is not JSON.
    }
    return `${fallback} (${response.status})`
  }

  async function deleteItem() {
    if (!task || task._isNew || !task.plane_id) return
    const isModule = task.plane_type === 'module'
    const kind = isModule ? 'Project' : (task.type === 'milestone' ? 'Milestone' : 'Task')
    try {
      const menu = el && el.querySelector('[data-actions-menu]')
      if (menu) menu.hidden = true
      const resp = await fetch(
        `${apiBase}/api/projects/${project}/trash/${isModule ? 'module' : 'issue'}/${task.plane_id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gantt_type: isModule ? 'project' : task.type }),
        },
      )
      if (!resp.ok) throw new Error(await responseErrorMessage(resp, `Failed to move ${kind.toLowerCase()} to Trash`))
      const result = await resp.json()
      close()
      reloadGantt()
      showTrashToast(result.item)
    } catch (err) {
      console.error('Sidebar delete failed:', err)
      window.alert(err.message || 'The item could not be deleted.')
    }
  }

  async function save() {
    if (!task) return
    const saveBtn = el.querySelector('[data-action="save"]')
    if (saveBtn) { saveBtn.textContent = 'Saving...'; saveBtn.disabled = true }

    try {
      if (task._isNew) {
        const targetDate = task.type === 'milestone' ? task.start_date : task.end_date
        const isModule = task.type === 'project'
        const resp = await fetch(`${apiBase}/api/projects/${project}/${isModule ? 'modules' : 'issues'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: task.text || (isModule ? 'Untitled Module' : 'Untitled'),
            description: task.description || '',
            start_date: task.start_date || null,
            target_date: targetDate || null,
            ...(isModule ? {} : { gantt_type: task.type === 'milestone' ? 'milestone' : 'task' }),
          }),
        })
        if (!resp.ok) throw new Error(await responseErrorMessage(resp, `Failed to create ${isModule ? 'project' : 'task'}`))
        reloadGantt()
      } else if (task.plane_type === 'issue' && task.type === 'project') {
        if (!window.confirm(
          `Promote “${task.text}” to a standalone Project?\n\n` +
          'A Plane Module will be created, direct subtasks will move into it, and the original task will be archived.'
        )) {
          if (saveBtn) { saveBtn.textContent = 'Save'; saveBtn.disabled = false }
          return
        }
        const resp = await fetch(
          `${apiBase}/api/projects/${project}/issues/${task.plane_id}/promote-to-module`,
          { method: 'POST' },
        )
        if (!resp.ok) throw new Error(await responseErrorMessage(resp, 'Failed to promote task'))
        reloadGantt()
      } else if (task.plane_type === 'module') {
        const resp = await fetch(`${apiBase}/api/projects/${project}/modules/${task.plane_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: task.text || 'Untitled Module',
            description: task.description || '',
            start_date: task.start_date || null,
            target_date: task.end_date || null,
          }),
        })
        if (!resp.ok) throw new Error(await responseErrorMessage(resp, 'Failed to save project'))
        reloadGantt()
      } else {
        if (task.plane_id) {
          const targetDate = task.type === 'milestone' ? task.start_date : task.end_date
          const resp = await fetch(`${apiBase}/api/projects/${project}/issues/${task.plane_id}/dates`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: task.text || 'Untitled',
              description: task.description || '',
              start_date: task.start_date || null,
              target_date: targetDate || null,
              gantt_type: task.type === 'milestone' ? 'milestone' : 'task',
            }),
          })
          if (!resp.ok) throw new Error(await responseErrorMessage(resp, 'Failed to save task'))
        }

        reloadGantt()
      }

      close()
    } catch (err) {
      console.error('Sidebar save failed:', err)
      window.alert(err.message || 'The change could not be saved.')
      if (saveBtn) { saveBtn.textContent = 'Save'; saveBtn.disabled = false }
    }
  }

  function updateDates(id, startDate, endDate) {
    if (!task || String(task.id) !== String(id)) return
    task.start_date = startDate
    task.end_date = endDate
    task.plane_start_date = startDate
    task.plane_target_date = endDate
    render()
  }

  function destroy() {
    close()
    if (toastTimer) clearTimeout(toastTimer)
    if (toast) toast.remove()
    toast = null
  }

  return { open, updateDates, close, destroy }
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
