import { create_object_preset_validator } from 'react-table'

export const PERSONNEL_GROUP_KEYS = ['rb', 'te', 'wr', 'qb', 'ol', 'dl', 'lb', 'db']
export const PERSONNEL_GROUP_VALUE_MAX = 9

export const validate_personnel_group_item = create_object_preset_validator({
  allowed_keys: PERSONNEL_GROUP_KEYS,
  value_max: PERSONNEL_GROUP_VALUE_MAX
})
