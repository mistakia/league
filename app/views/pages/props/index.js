import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { propActions, getFilteredProps } from '@core/props'

import PropsPage from './props'

const mapStateToProps = createSelector(getFilteredProps, (player_props) => ({
  player_props
}))

const mapDispatchToProps = {
  load: propActions.load
}

export default connect(mapStateToProps, mapDispatchToProps)(PropsPage)
