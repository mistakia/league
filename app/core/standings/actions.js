export const standingsActions = {
  SET_STANDINGS: 'SET_STANDINGS',

  setStandings: standings => ({
    type: standingsActions.SET_STANDINGS,
    payload: {
      standings
    }
  })
}
