import { computed, ref } from 'vue'

export const GANTT_SIDEBARS = Object.freeze({
  FIELDS: 'fields',
  TRASH: 'trash',
})

const SIDEBAR_NAMES = new Set(Object.values(GANTT_SIDEBARS))

/**
 * Owns the mutually exclusive state for Gantt sidebars.
 *
 * Consumers composing the bare chart with SDK panels should use this controller
 * instead of maintaining independent booleans for Fields and Trash.
 */
export function useGanttSidebars(initialSidebar = null) {
  const activeSidebar = ref(SIDEBAR_NAMES.has(initialSidebar) ? initialSidebar : null)

  function setSidebar(name) {
    activeSidebar.value = SIDEBAR_NAMES.has(name) ? name : null
  }

  function createOpenState(name) {
    return computed({
      get: () => activeSidebar.value === name,
      set: (open) => {
        if (open) setSidebar(name)
        else if (activeSidebar.value === name) setSidebar(null)
      },
    })
  }

  const fieldsOpen = createOpenState(GANTT_SIDEBARS.FIELDS)
  const trashOpen = createOpenState(GANTT_SIDEBARS.TRASH)

  function toggleSidebar(name) {
    setSidebar(activeSidebar.value === name ? null : name)
  }

  return {
    activeSidebar,
    fieldsOpen,
    trashOpen,
    openFields: () => setSidebar(GANTT_SIDEBARS.FIELDS),
    closeFields: () => {
      if (fieldsOpen.value) setSidebar(null)
    },
    toggleFields: () => toggleSidebar(GANTT_SIDEBARS.FIELDS),
    openTrash: () => setSidebar(GANTT_SIDEBARS.TRASH),
    closeTrash: () => {
      if (trashOpen.value) setSidebar(null)
    },
    toggleTrash: () => toggleSidebar(GANTT_SIDEBARS.TRASH),
    closeAll: () => setSidebar(null),
  }
}

