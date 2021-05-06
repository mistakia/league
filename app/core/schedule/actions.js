export const scheduleActions = {
  GET_SCHEDULE_PENDING: 'GET_SCHEULDE_PENDING',
  GET_SCHEDULE_FAILED: 'GET_SCHEDULE_FAILED',
  GET_SCHEDULE_FULFILLED: 'GET_SCHEDULE_FULFILLED',

  getSchedulePending: (opts) => ({
    type: scheduleActions.GET_SCHEDULE_PENDING,
    payload: {
      opts
    }
  }),

  getScheduleFailed: (opts, error) => ({
    type: scheduleActions.GET_SCHEDULE_FAILED,
    payload: {
      opts,
      error
    }
  }),

  getScheduleFulfilled: (opts, data) => ({
    type: scheduleActions.GET_SCHEDULE_FULFILLED,
    payload: {
      opts,
      data
    }
  })
}

export const getScheduleActions = {
  pending: scheduleActions.getSchedulePending,
  failed: scheduleActions.getScheduleFailed,
  fulfilled: scheduleActions.getScheduleFulfilled
}
