export const confirmationActions = {
  SHOW_CONFIRMATION: 'SHOW_CONFIRMATION',
  CANCEL_CONFIRMATION: 'CANCEL_CONFIRMATION',

  show: ({ title, description, onConfirm }) => ({
    type: confirmationActions.SHOW_CONFIRMATION,
    payload: {
      title,
      description,
      onConfirm
    }
  }),

  cancel: () => ({
    type: confirmationActions.CANCEL_CONFIRMATION
  })
}
