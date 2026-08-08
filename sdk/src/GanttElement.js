/**
 * <mcmc-gantt> Web Component — framework-agnostic embeddable Gantt chart.
 *
 * Usage:
 *   <mcmc-gantt project="persada-phase-1" api="https://gantt.mcmc.gov.my"></mcmc-gantt>
 *   <script src="https://gantt.mcmc.gov.my/sdk/gantt-element.js"></script>
 *
 * Attributes:
 *   project  — project slug (required)
 *   api      — base URL of the Gantt API (default: same origin)
 *   editable — make chart editable (presence = true)
 *   scale    — initial scale: day|week|month (default: month)
 *   height   — container height (default: 600px)
 */

import { mountGantt } from './core.js'

class McmcGantt extends HTMLElement {
  static get observedAttributes() {
    return ['project', 'api', 'editable', 'scale', 'height']
  }

  constructor() {
    super()
    this._controller = null
    this._shadow = this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this._render()
  }

  disconnectedCallback() {
    if (this._controller) {
      this._controller.destroy()
      this._controller = null
    }
  }

  attributeChangedCallback() {
    // Re-render on attribute change
    if (this._controller) {
      this._controller.destroy()
      this._controller = null
    }
    this._render()
  }

  _render() {
    const project = this.getAttribute('project')
    if (!project) return

    const api = this.getAttribute('api') || ''
    const editable = this.hasAttribute('editable')
    const scale = this.getAttribute('scale') || 'month'
    const height = this.getAttribute('height') || '600px'

    // Build shadow DOM
    this._shadow.innerHTML = `
      <style>
        :host { display: block; width: 100%; }
        .gantt-wrapper { width: 100%; height: ${height}; position: relative; }
        .gantt-today-cell { background: rgba(229, 57, 53, 0.08); border-left: 2px solid #e53935; }
        .gantt_task_line.gantt_project { background: #2563eb !important; border-color: #2563eb !important; border-radius: 4px; }
        .gantt_task_line.gantt_task { background: #10b981 !important; border-color: #10b981 !important; border-radius: 4px; }
        .gantt_task_line.milestone_task { background: #f59e0b !important; border-color: #f59e0b !important; }
        .gantt_task_line .gantt_task_progress { background: rgba(0,0,0,0.15); border-radius: 4px; }
        .gantt_grid_head_cell { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; }
        .gantt_tree_content { font-size: 13px; }
        .gantt_row.gantt_project .gantt_tree_content { font-weight: 700; }
      </style>
      <div class="gantt-wrapper" id="gantt-container"></div>
    `

    const container = this._shadow.getElementById('gantt-container')

    this._controller = mountGantt({
      container,
      project,
      apiBase: api,
      editable,
      scale,
      onTaskClick: (task) => {
        this.dispatchEvent(new CustomEvent('task-click', { detail: task, bubbles: true }))
      },
      onTaskChange: (task) => {
        this.dispatchEvent(new CustomEvent('task-change', { detail: task, bubbles: true }))
      },
    })
  }
}

// Register the custom element
if (!customElements.get('mcmc-gantt')) {
  customElements.define('mcmc-gantt', McmcGantt)
}

export { McmcGantt }
