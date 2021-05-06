import { connect } from 'react-redux'

import { settingActions } from '@core/settings'

import EditableValueWeight from './editable-value-weight'

const mapDispatchToProps = {
  update: settingActions.update
}

export default connect(null, mapDispatchToProps)(EditableValueWeight)
