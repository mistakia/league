import { createSelector } from 'reselect'
import { connect } from 'react-redux'

import { getApp } from '@core/app'
import { draftActions, getDraft, isDrafted } from '@core/draft'

import DraftPlayer from './draft-player'

const mapStateToProps = createSelector(
  getDraft,
  isDrafted,
  getApp,
  (draft, isDrafted, app) => ({
    selected: draft.selected,
    isDrafted,
    vbaseline: app.vbaseline
  })
)

const mapDispatchToProps = {
  select: draftActions.selectPlayer
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(DraftPlayer)
