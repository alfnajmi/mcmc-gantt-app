/**
 * @mcmc/gantt-chart — main entry point
 *
 * Exports:
 *   mountGantt     — imperative API (mount into any DOM element)
 *   GanttChart     — Vue 3 component
 *   McmcGantt      — Web Component class (auto-registered as <mcmc-gantt>)
 */

export { mountGantt } from './core.js'
export { McmcGantt } from './GanttElement.js'

// Vue component exported from separate entry for tree-shaking
// import { GanttChart } from '@mcmc/gantt-chart/vue'
