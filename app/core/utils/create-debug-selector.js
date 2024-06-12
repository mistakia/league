import { createSelectorCreator, lruMemoize } from 'reselect'

export const create_debug_selector = createSelectorCreator(lruMemoize, {
  equalityCheck: (previousVal, currentVal) => {
    const rv = currentVal === previousVal
    if (!rv) console.log('Selector param value changed', currentVal)
    return rv
  }
})
