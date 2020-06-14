import { createSelector } from 'reselect'
import { connect } from 'react-redux'

import { draftActions, getDraft, isDrafted } from '@core/draft'

import DraftPlayer from './draft-player'

const mapStateToProps = createSelector(
  getDraft,
  isDrafted,
  (draft, isDrafted) => ({ selected: draft.selected, isDrafted })
)

const mapDispatchToProps = {
  select: draftActions.selectPlayer
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DraftPlayer)
