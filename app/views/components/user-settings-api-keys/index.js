import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { api_key_actions } from '@core/api-keys'

import UserSettingsApiKeys from './user-settings-api-keys'

const get_api_keys_state = (state) => state.get('api_keys')

const map_state_to_props = createSelector(get_api_keys_state, (api_keys) => ({
  api_keys: api_keys.get('keys'),
  data_view_export_max_rows: api_keys.get('data_view_export_max_rows'),
  generated_key: api_keys.get('generated_key'),
  is_pending: api_keys.get('is_pending')
}))

const map_dispatch_to_props = {
  load: api_key_actions.load,
  create: api_key_actions.create,
  revoke: api_key_actions.revoke,
  dismiss_generated_key: api_key_actions.dismiss_generated_key
}

export default connect(
  map_state_to_props,
  map_dispatch_to_props
)(UserSettingsApiKeys)
