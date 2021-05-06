import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { getSourceById, sourceActions } from '@core/sources'

import EditableSource from './editable-source'

const mapStateToProps = createSelector(getSourceById, (source) => ({ source }))

const mapDispatchToProps = {
  update: sourceActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(EditableSource)
