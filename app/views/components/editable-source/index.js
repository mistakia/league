import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { sourceActions } from '@core/sources'
import { get_source_by_id } from '@core/selectors'

import EditableSource from './editable-source'

const mapStateToProps = createSelector(get_source_by_id, (source) => ({
  source
}))

const mapDispatchToProps = {
  update: sourceActions.update
}

export default connect(mapStateToProps, mapDispatchToProps)(EditableSource)
