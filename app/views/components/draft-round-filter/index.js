import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getPlayers } from '@core/players'

import DraftRoundFilter from './draft-round-filter'

const mapStateToProps = createSelector(getPlayers, (players) => ({
  nfl_draft_rounds: players.get('nfl_draft_rounds')
}))

export default connect(mapStateToProps)(DraftRoundFilter)
