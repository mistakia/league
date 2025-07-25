import { Record } from 'immutable'
import { context_menu_actions } from './actions'

const ContextMenuState = new Record({
  id: null,
  visible: false,
  clickX: null,
  clickY: null,
  data: {}
})

export function context_menu_reducer(
  state = new ContextMenuState(),
  { payload, type }
) {
  switch (type) {
    case context_menu_actions.SHOW_CONTEXT_MENU: {
      const { id, data, clickX, clickY } = payload
      return state.merge({
        id,
        data,
        clickX,
        clickY,
        visible: true
      })
    }

    case context_menu_actions.HIDE_CONTEXT_MENU:
      return new ContextMenuState()

    default:
      return state
  }
}
