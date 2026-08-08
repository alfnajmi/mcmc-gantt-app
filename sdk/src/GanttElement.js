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
        .gantt_cal_light { font-family: -apple-system, "Segoe UI", Roboto, sans-serif !important; border-radius: 12px !important; border: 1px solid #e2e8f0 !important; box-shadow: 0 8px 30px rgba(0,0,0,0.12) !important; overflow: hidden; width: 450px !important; }
        .gantt_cal_ltitle { background: #fff !important; border-bottom: 1px solid #e2e8f0 !important; padding: 16px 20px !important; height: auto !important; line-height: normal !important; }
        .gantt_cal_ltitle span { font-size: 16px !important; font-weight: 700 !important; color: #1e293b !important; }
        .gantt_cal_larea { background: #fff !important; padding: 16px 20px !important; }
        .gantt_cal_lsection { font-size: 12px !important; font-weight: 600 !important; color: #64748b !important; padding: 8px 0 4px !important; border: none !important; }
        .gantt_cal_lfoot { background: #fff !important; border-top: 1px solid #e2e8f0 !important; padding: 12px 20px !important; display: flex !important; justify-content: flex-end !important; gap: 8px !important; }
        .gantt_cal_lfoot .gantt_btn_set { border-radius: 6px !important; padding: 8px 16px !important; font-size: 13px !important; font-weight: 600 !important; border: 1px solid #e2e8f0 !important; margin: 0 !important; height: auto !important; line-height: normal !important; }
        .gantt_cal_lfoot .gantt_save_btn_set { background: #2563eb !important; color: #fff !important; border-color: #2563eb !important; }
        .gantt_cal_lfoot .gantt_cancel_btn_set { background: #fff !important; color: #1e293b !important; }
        .gantt_cal_lfoot .gantt_delete_btn_set { background: transparent !important; color: #dc2626 !important; border-color: transparent !important; margin-right: auto !important; }
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
