import { connect } from 'react-redux'

import { appActions } from '@core/app'

import Logout from './logout'

const mapDispatchToProps = {
  logout: appActions.logout
}

export default connect(
  null,
  mapDispatchToProps
)(Logout)
