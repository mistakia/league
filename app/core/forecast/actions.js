export const forecastActions = {
  SET_FORECAST: 'SET_FORECAST',

  setForecast: (forecast) => ({
    type: forecastActions.SET_FORECAST,
    payload: {
      forecast
    }
  })
}
