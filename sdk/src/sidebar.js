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
  display: flex;
  align-items: center;
  gap: 10px;
}
.gantt-sidebar-id {
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
  display: flex;
  gap: 2px;
}
/* Type dropdown */
.gantt-type-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}
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
  align-items: center;
  gap: 6px;
}
.gantt-date-chip {
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
.gantt-sidebar-footer button.save {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.gantt-sidebar-footer button.save:hover { background: #1d4ed8; }
.gantt-sidebar-footer button.save:disabled { opacity: 0.6; cursor: not-allowed; }
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
  const { container, apiBase, project, planeUrl, workspaceSlug, projectId } = opts
  let el = null
  let overlay = null
  let width = 360
  let task = null
  let calField = null // 'start' | 'end' | null
  let calDate = new Date()

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
    task.text = (task.text || '').replace(/^[\u{1F4E6}\u{1F504}]\s*/u, '')
    task.type = task.type || 'task'
    task.status = task.status || 'to do'
    task.description = task.description || ''
    calField = null
    render()
  }

  function close() {
    if (el) { el.remove(); el = null }
    if (overlay) { overlay.remove(); overlay = null }
    task = null
  }

  function render() {
    if (!task) return
    close()

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
          <div style="position:relative">
            <button class="gantt-type-btn" data-action="toggle-type">${typeOpt.icon} ${typeOpt.label} ▾</button>
          </div>
          ${seqId}
        </div>
        <div class="gantt-sidebar-actions">
          ${planeUrl ? `<button class="gantt-sidebar-icon-btn" data-action="open-plane" title="Open in Plane">↗</button>` : ''}
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
      else if (action === 'toggle-type') showDropdown('type', btn)
      else if (action === 'toggle-status') showDropdown('status', btn)
      else if (action === 'pick-start') { calField = calField === 'start' ? null : 'start'; calDate = task.start_date ? new Date(task.start_date) : new Date(); render() }
      else if (action === 'pick-end') { calField = calField === 'end' ? null : 'end'; calDate = task.end_date ? new Date(task.end_date) : new Date(); render() }
      else if (action === 'cal-prev') { calDate.setMonth(calDate.getMonth() - 1); render() }
      else if (action === 'cal-next') { calDate.setMonth(calDate.getMonth() + 1); render() }
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
        function onMove(ev) { width = Math.max(280, Math.min(600, startW + (startX - ev.clientX))); el.style.width = width + 'px' }
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

    const options = type === 'type' ? TYPE_OPTIONS : STATUS_OPTIONS
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
        if (type === 'type') task.type = opt.value
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

  async function save() {
    if (!task) return
    const saveBtn = el.querySelector('[data-action="save"]')
    if (saveBtn) { saveBtn.textContent = 'Saving...'; saveBtn.disabled = true }

    try {
      if (task._isNew) {
        // Create new task in Plane
        const resp = await fetch(`${apiBase}/api/projects/${project}/issues`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: task.text || 'Untitled',
            start_date: task.start_date || null,
            target_date: task.end_date || null,
          }),
        })
        if (resp.ok) {
          // Reload gantt to show new task
          if (window.gantt) {
            window.gantt.clearAll()
            window.gantt.load(`${apiBase}/api/projects/${project}/data`)
          }
        }
      } else {
        // Update existing — PATCH dates
        if (task.plane_type !== 'module' && task.plane_id) {
          await fetch(`${apiBase}/api/projects/${project}/issues/${task.plane_id}/dates`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start_date: task.start_date || null,
              target_date: task.end_date || null,
            }),
          })
        }

        // Update gantt locally
        if (window.gantt && window.gantt.isTaskExists(task.id)) {
          const gt = window.gantt.getTask(task.id)
          gt.text = task.plane_type === 'module' ? '📦 ' + task.text : task.text
          gt.status = task.status
          gt.type = task.type
          if (task.start_date) gt.start_date = new Date(task.start_date)
          if (task.end_date) gt.end_date = new Date(task.end_date)
          window.gantt.updateTask(task.id)
        }
      }

      close()
    } catch (err) {
      console.error('Sidebar save failed:', err)
      if (saveBtn) { saveBtn.textContent = 'Save'; saveBtn.disabled = false }
    }
  }

  return { open, close, destroy: close }
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
