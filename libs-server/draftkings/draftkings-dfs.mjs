import debug from 'debug'

import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'
import { get_draftkings_config } from './draftkings-config.mjs'

const api_log = debug('draft-kings:dfs:api')

const get_draftkings_contests = async () => {
  const draftkings_config = await get_draftkings_config()
  const url = draftkings_config.draftkings_contests_url
  api_log(`DK API REQUEST: ${url}`)
  const data = await fetch_with_retry({ url, response_type: 'json' })
  return data
}

export const get_draftkings_draft_groups = async () => {
  const data = await get_draftkings_contests()
  return data.DraftGroups
}

export const get_draftkings_nfl_draft_groups = async () => {
  const draft_groups = await get_draftkings_draft_groups()
  return draft_groups.filter(
    (draft_group) => draft_group.Sport === 'NFL' && draft_group.GameTypeId === 1
  )
}

export const get_draftkings_draft_group_draftables = async ({
  draft_group_id
}) => {
  const draftkings_config = await get_draftkings_config()
  const url = `${draftkings_config.draftkings_salary_url}/${draft_group_id}/draftables`
  api_log(`DK API REQUEST: ${url}`)
  const data = await fetch_with_retry({ url, response_type: 'json' })
  return data
}
