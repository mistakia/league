export const confirmation_actions = {
  SHOW_CONFIRMATION: 'SHOW_CONFIRMATION',
  CANCEL_CONFIRMATION: 'CANCEL_CONFIRMATION',

  show: ({ title, description, id, on_confirm_func, data }) => ({
    type: confirmation_actions.SHOW_CONFIRMATION,
    payload: {
      title,
      data,
      description,
      id,
      on_confirm_func
    }
  }),

  cancel: () => ({
    type: confirmation_actions.CANCEL_CONFIRMATION
  })
}
