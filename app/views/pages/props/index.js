import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { propActions } from '@core/props'
import { getFilteredProps } from '@core/selectors'

import PropsPage from './props'

const mapStateToProps = createSelector(getFilteredProps, (player_props) => ({
  player_props
}))

const mapDispatchToProps = {
  load: propActions.load
}

export default connect(mapStateToProps, mapDispatchToProps)(PropsPage)
