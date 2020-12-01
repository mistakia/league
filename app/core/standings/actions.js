export const standingsActions = {
  SET_STANDINGS: 'SET_STANDINGS',

  setStandings: ({ teams, percentiles }) => ({
    type: standingsActions.SET_STANDINGS,
    payload: {
      teams,
      percentiles
    }
  })
}
