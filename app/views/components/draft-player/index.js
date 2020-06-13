import { createSelector } from 'reselect'
import { connect } from 'react-redux'

import { draftActions, getDraft } from '@core/draft'

import DraftPlayer from './draft-player'

const mapStateToProps = createSelector(
  getDraft,
  (draft) => ({ selected: draft.selected })
)

const mapDispatchToProps = {
  select: draftActions.selectPlayer
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DraftPlayer)
