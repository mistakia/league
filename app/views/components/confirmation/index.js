import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { confirmationActions } from '@core/confirmations'
import { get_confirmation_info } from '@core/selectors'

import Confirmation from './confirmation'

const mapStateToProps = createSelector(get_confirmation_info, (info) => ({
  info
}))

const mapDispatchToProps = {
  cancel: confirmationActions.cancel
}

export default connect(mapStateToProps, mapDispatchToProps)(Confirmation)
