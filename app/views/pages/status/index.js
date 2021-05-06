import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getStatus, statusActions } from '@core/status'

import StatusPage from './status'

const mapStateToProps = createSelector(getStatus, (status) => ({ status }))

const mapDispatchToProps = {
  load: statusActions.load
}

export default connect(mapStateToProps, mapDispatchToProps)(StatusPage)
