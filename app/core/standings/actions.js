export const standingsActions = {
  STANDINGS_SELECT_YEAR: 'STANDINGS_SELECT_YEAR',

  selectYear: (year) => ({
    type: standingsActions.STANDINGS_SELECT_YEAR,
    payload: {
      year
    }
  })
}
