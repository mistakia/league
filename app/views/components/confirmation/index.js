import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { confirmationActions, getConfirmationInfo } from '@core/confirmations'

import Confirmation from './confirmation'

const mapStateToProps = createSelector(getConfirmationInfo, (info) => ({
  info
}))

const mapDispatchToProps = {
  cancel: confirmationActions.cancel
}

export default connect(mapStateToProps, mapDispatchToProps)(Confirmation)
