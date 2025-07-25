export const notification_actions = {
  SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',

  show: ({ message, severity }) => ({
    type: notification_actions.SHOW_NOTIFICATION,
    payload: {
      message,
      severity
    }
  })
}
