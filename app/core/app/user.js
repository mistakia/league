import { Record } from 'immutable'

export const User = Record({
  id: null,
  username: null,
  email: null
})

export function create_user_record({ id, username, email }) {
  return new User({
    id,
    username,
    email
  })
}
