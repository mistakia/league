const NFL_WEEK_SELECTION_HISTORY_LIMIT = 50

export const create_initial_history = (present) => ({
  past: [],
  present,
  future: []
})

export const push_history = ({ history, next_present }) => {
  const past = [...history.past, history.present].slice(
    -NFL_WEEK_SELECTION_HISTORY_LIMIT
  )
  return { past, present: next_present, future: [] }
}

export const undo_history = (history) => {
  if (history.past.length === 0) return history
  const past = history.past.slice(0, -1)
  const present = history.past[history.past.length - 1]
  const future = [history.present, ...history.future]
  return { past, present, future }
}

export const redo_history = (history) => {
  if (history.future.length === 0) return history
  const [present, ...future] = history.future
  const past = [...history.past, history.present]
  return { past, present, future }
}

export const can_undo = (history) => history.past.length > 0
export const can_redo = (history) => history.future.length > 0
