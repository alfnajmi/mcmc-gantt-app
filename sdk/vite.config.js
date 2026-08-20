import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        'gantt-chart': resolve(__dirname, 'src/index.js'),
        'gantt-element': resolve(__dirname, 'src/GanttElement.js'),
        'gantt-vue': resolve(__dirname, 'src/GanttChart.vue'),
        'gantt-view': resolve(__dirname, 'src/GanttView.vue'),
        'gantt-fields-panel': resolve(__dirname, 'src/GanttFieldsPanel.vue'),
      },
      formats: ['es'],
      name: 'McmcGantt',
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
    cssCodeSplit: false,
  },
})
