export const confirmationActions = {
  SHOW_CONFIRMATION: 'SHOW_CONFIRMATION',
  CANCEL_CONFIRMATION: 'CANCEL_CONFIRMATION',

  show: ({ title, description, id, onConfirm, data }) => ({
    type: confirmationActions.SHOW_CONFIRMATION,
    payload: {
      title,
      data,
      description,
      id,
      onConfirm
    }
  }),

  cancel: () => ({
    type: confirmationActions.CANCEL_CONFIRMATION
  })
}
