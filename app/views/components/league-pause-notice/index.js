import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { get_current_league } from '@core/selectors'

import LeaguePauseNotice from './league-pause-notice'

// The banner maps its own state rather than being handed a prop by `app.js`.
// `app.js` receives no league today and its container maps only derived
// booleans, so threading one through would add a league dependency to the whole
// app shell for the sake of one banner.
const map_state_to_props = createSelector(get_current_league, (league) => ({
  paused_at: league.paused_at
}))

export default connect(map_state_to_props)(LeaguePauseNotice)
