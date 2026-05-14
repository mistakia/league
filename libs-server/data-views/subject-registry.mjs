import player from './subjects/player.mjs'
import team from './subjects/team.mjs'

const subjects = { player, team }

export const resolve_subject = (subject_id) => {
  const subject = subjects[subject_id]
  if (!subject) {
    throw new Error(`Unknown subject: ${subject_id}`)
  }
  return subject
}

const identity_for_subject_splits = (subject_id, splits) => {
  const has_year = splits.includes('year')
  const has_week = splits.includes('week')
  if (subject_id === 'player') {
    if (has_week) return 'player_year_week'
    if (has_year) return 'player_year'
    return 'player'
  }
  if (subject_id === 'team') {
    if (has_week) return 'team_year_week'
    if (has_year) return 'team_year'
    return 'team'
  }
  throw new Error(`Unknown subject: ${subject_id}`)
}

export const identity_for = ({ subject_id, splits = [] }) =>
  identity_for_subject_splits(subject_id, splits)

export { subjects }
