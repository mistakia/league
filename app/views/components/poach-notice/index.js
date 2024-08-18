import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { poachActions } from '@core/poaches/actions'
import { confirmationActions } from '@core/confirmations'
import { get_app } from '@core/selectors'

import PoachNotice from './poach-notice'

const mapStateToProps = createSelector(get_app, (app) => ({
  teamId: app.teamId
}))

const mapDispatchToProps = {
  process_poach: poachActions.process_poach,
  showConfirmation: confirmationActions.show
}

export default connect(mapStateToProps, mapDispatchToProps)(PoachNotice)
