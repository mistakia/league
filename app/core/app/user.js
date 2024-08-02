import { Record } from 'immutable'

export const User = Record({
  id: null,
  username: null,
  email: null,
  phone: null,
  user_text_notifications: null,
  user_voice_notifications: null
})

export function create_user_record({
  id,
  username,
  email,
  phone,
  user_text_notifications,
  user_voice_notifications
}) {
  return new User({
    id,
    username,
    email,
    phone,
    user_text_notifications,
    user_voice_notifications
  })
}
