/**
 * @alfnajmi__/gantt-chart — main entry point
 *
 * Exports:
 *   mountGantt     — imperative API (mount into any DOM element)
 *   GanttChart     — Vue 3 component (bare renderer)
 *   GanttView      — Vue 3 component (full-featured: toolbar + filters + fields)
 *   McmcGantt      — Web Component class (auto-registered as <mcmc-gantt>)
 */

export { mountGantt } from './core.js'
export { McmcGantt } from './GanttElement.js'

// Vue components exported from separate entries for tree-shaking:
// import GanttChart from '@alfnajmi__/gantt-chart/vue'       — bare chart
// import GanttView from '@alfnajmi__/gantt-chart/view'       — full view with toolbar
