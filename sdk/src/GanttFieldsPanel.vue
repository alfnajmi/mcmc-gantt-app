<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  fields: { type: Array, default: () => [] },
  shownFields: { type: Object, default: () => ({}) },
  minWidth: { type: Number, default: 240 },
  maxWidth: { type: Number, default: 520 },
  initialWidth: { type: Number, default: 280 },
})

const emit = defineEmits(['close', 'toggle'])
const panelRef = ref(null)
const search = ref('')
const width = ref(props.initialWidth)
const top = ref(0)
let toolbarObserver = null
let stopResize = null

const normalizedSearch = computed(() => search.value.trim().toLowerCase())
const shown = computed(() =>
  props.fields.filter(
    (field) =>
      props.shownFields[field.key] &&
      (!normalizedSearch.value || field.label.toLowerCase().includes(normalizedSearch.value)),
  ),
)
const hidden = computed(() =>
  props.fields.filter(
    (field) =>
      !props.shownFields[field.key] &&
      (!normalizedSearch.value || field.label.toLowerCase().includes(normalizedSearch.value)),
  ),
)

function updateTopOffset() {
  const host = panelRef.value?.parentElement
  const toolbar = host?.querySelector('.gantt-toolbar, .gv-toolbar')
  top.value = toolbar?.offsetHeight ?? 0
}

function observeToolbar() {
  toolbarObserver?.disconnect()
  toolbarObserver = null
  updateTopOffset()

  const host = panelRef.value?.parentElement
  const toolbar = host?.querySelector('.gantt-toolbar, .gv-toolbar')
  if (toolbar && typeof ResizeObserver !== 'undefined') {
    toolbarObserver = new ResizeObserver(updateTopOffset)
    toolbarObserver.observe(toolbar)
  }
}

function startResize(event) {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = width.value

  const onMove = (moveEvent) => {
    const nextWidth = startWidth + startX - moveEvent.clientX
    width.value = Math.min(props.maxWidth, Math.max(props.minWidth, nextWidth))
  }
  const onUp = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    stopResize = null
  }

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
  stopResize = onUp
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      toolbarObserver?.disconnect()
      toolbarObserver = null
      return
    }
    await nextTick()
    observeToolbar()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  toolbarObserver?.disconnect()
  stopResize?.()
})
</script>

<template>
  <Transition name="mcmc-fields-slide">
    <aside
      v-if="open"
      ref="panelRef"
      class="mcmc-fields-panel"
      :style="{ top: `${top}px`, width: `${width}px` }"
      aria-label="Gantt fields"
    >
      <button
        type="button"
        class="mcmc-fields-resizer"
        aria-label="Resize fields sidebar"
        @pointerdown="startResize"
      ></button>

      <header class="mcmc-fields-header">
        <h3>Fields</h3>
        <button type="button" class="mcmc-fields-close" aria-label="Close fields" @click="emit('close')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div class="mcmc-fields-search">
        <input v-model="search" type="search" placeholder="Search Task Fields" />
      </div>

      <div class="mcmc-fields-tabs"><span>Add existing</span></div>

      <div class="mcmc-fields-body">
        <section class="mcmc-fields-section">
          <header><span>Shown</span><b>{{ shown.length }}</b></header>
          <div v-for="field in shown" :key="field.key" class="mcmc-field-row">
            <span class="mcmc-field-icon" v-html="`<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${field.icon || ''}</svg>`"></span>
            <span class="mcmc-field-label">{{ field.label }}</span>
            <label class="mcmc-field-toggle">
              <input
                type="checkbox"
                checked
                :disabled="field.alwaysOn"
                @change="emit('toggle', field.key, $event.target.checked)"
              />
              <span></span>
            </label>
          </div>
        </section>

        <section v-if="hidden.length" class="mcmc-fields-section">
          <header><span>Properties</span><b>{{ hidden.length }}</b></header>
          <div v-for="field in hidden" :key="field.key" class="mcmc-field-row">
            <span class="mcmc-field-icon" v-html="`<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${field.icon || ''}</svg>`"></span>
            <span class="mcmc-field-label">{{ field.label }}</span>
            <label class="mcmc-field-toggle">
              <input type="checkbox" @change="emit('toggle', field.key, $event.target.checked)" />
              <span></span>
            </label>
          </div>
        </section>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.mcmc-fields-panel {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  min-width: 240px;
  max-width: min(520px, 92vw);
  border-left: 1px solid #e2e8f0;
  background: #fff;
  box-shadow: -2px 0 12px rgba(15, 23, 42, 0.08);
}
.mcmc-fields-resizer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -5px;
  width: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
}
.mcmc-fields-resizer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 2px;
  background: #60a5fa;
  opacity: 0;
  transition: opacity 140ms ease;
}
.mcmc-fields-resizer:hover::after,
.mcmc-fields-resizer:focus-visible::after { opacity: 1; }
.mcmc-fields-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 11px;
  border-bottom: 1px solid #e2e8f0;
}
.mcmc-fields-header h3 { margin: 0; color: #1e293b; font-size: 14px; }
.mcmc-fields-close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  color: #64748b;
  background: transparent;
  cursor: pointer;
}
.mcmc-fields-close:hover { color: #1e293b; background: #f1f5f9; }
.mcmc-fields-search { padding: 12px 12px 8px; }
.mcmc-fields-search input {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #334155;
  font: inherit;
  font-size: 11px;
  outline: none;
}
.mcmc-fields-search input:focus { border-color: #60a5fa; box-shadow: 0 0 0 2px #dbeafe; }
.mcmc-fields-tabs { padding: 0 12px; border-bottom: 1px solid #e2e8f0; }
.mcmc-fields-tabs span {
  display: inline-flex;
  padding: 8px 0 7px;
  border-bottom: 2px solid #2563eb;
  color: #1e293b;
  font-size: 10px;
  font-weight: 700;
}
.mcmc-fields-body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 12px 16px; }
.mcmc-fields-section + .mcmc-fields-section { margin-top: 14px; }
.mcmc-fields-section header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px 6px;
  color: #64748b;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
}
.mcmc-fields-section header b { font-size: 9px; }
.mcmc-field-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 4px 2px;
  color: #334155;
  font-size: 11px;
}
.mcmc-field-icon { display: grid; place-items: center; color: #94a3b8; }
.mcmc-field-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mcmc-field-toggle { position: relative; width: 30px; height: 17px; }
.mcmc-field-toggle input { position: absolute; width: 0; height: 0; opacity: 0; }
.mcmc-field-toggle > span {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: #cbd5e1;
  cursor: pointer;
  transition: background 140ms ease;
}
.mcmc-field-toggle > span::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .24);
  transition: transform 140ms ease;
}
.mcmc-field-toggle input:checked + span { background: #4f7df3; }
.mcmc-field-toggle input:checked + span::before { transform: translateX(13px); }
.mcmc-field-toggle input:disabled + span { opacity: .7; cursor: not-allowed; }
.mcmc-fields-slide-enter-active,
.mcmc-fields-slide-leave-active { transition: transform 180ms ease; }
.mcmc-fields-slide-enter-from,
.mcmc-fields-slide-leave-to { transform: translateX(100%); }
</style>
