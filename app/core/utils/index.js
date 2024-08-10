export * as actions_utils from './actions-utils'
export { localStorageAdapter } from './local-storage'
export { fuzzySearch } from './fuzzy-search'
export { timeago } from './timeago'
export { default as useTraceUpdate } from './use-trace-update'
export { create_debug_selector } from './create-debug-selector'
export { default as shorten_url } from './shorten-url'

export const ordinalSuffixOf = (i) => {
  const j = i % 10
  const k = i % 100
  if (j === 1 && k !== 11) {
    return i + 'st'
  }
  if (j === 2 && k !== 12) {
    return i + 'nd'
  }
  if (j === 3 && k !== 13) {
    return i + 'rd'
  }
  return i + 'th'
}
