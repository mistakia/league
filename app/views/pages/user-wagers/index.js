import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { wagerActions } from '@core/wagers'

import UserWagersPage from './user-wagers'

const mapDispathToProps = {
  loadUserWagers: wagerActions.loadUserWagers
}

export default connect(null, mapDispathToProps)(UserWagersPage)
