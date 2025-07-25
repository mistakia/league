export const context_menu_actions = {
  SHOW_CONTEXT_MENU: 'SHOW_CONTEXT_MENU',
  HIDE_CONTEXT_MENU: 'HIDE_CONTEXT_MENU',

  hide: () => ({
    type: context_menu_actions.HIDE_CONTEXT_MENU
  }),

  show: ({ id, data, clickX, clickY }) => ({
    type: context_menu_actions.SHOW_CONTEXT_MENU,
    payload: {
      id,
      data,
      clickX,
      clickY
    }
  })
}
