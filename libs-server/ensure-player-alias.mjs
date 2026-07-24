import debug from 'debug'

import { format_player_name } from '#libs-shared'
import db from '#db'

const log = debug('ensure-player-alias')

/*
   Record a normalized name variant for a player in player_aliases so the
   name-based fallback in find_player_row resolves it.

   Motivating class: some feeds (notably NFL FDL) store a fused legal first
   name -- e.g. person.firstName "De'Zhaun-Ryan" -- while every other source,
   and NFL's own displayName, uses the football name "De'Zhaun Stribling". The
   player row is created from the fused firstName, so its formatted_name
   diverges from the name other feeds send and their name-fallback misses. The
   fix is to record the football-name form as an alias, keyed to a player we
   have already identified by a strong key. This never loosens matching -- it
   only adds an exact-match alternate -- so it carries no reused-name hijack
   risk (see guideline/nfl/league/league-player-resolution.md).

   Idempotent. No-op when the variant is empty, equals the player's canonical
   formatted_name, or already exists. Pass the known formatted_name to skip the
   canonical-name lookup on the common (non-divergent) path.
*/
const ensure_player_alias = async ({
  pid,
  name,
  formatted_name = null,
  source = 'manual'
}) => {
  if (!pid || !name) {
    return 0
  }

  const formatted_alias = format_player_name(name)
  if (!formatted_alias) {
    return 0
  }

  // Fast path: caller supplied the canonical name and the variant matches it.
  if (formatted_name && formatted_alias === formatted_name) {
    return 0
  }

  let canonical_name = formatted_name
  if (!canonical_name) {
    const player_row = await db('player').where({ pid }).first('formatted_name')
    if (!player_row) {
      return 0
    }
    canonical_name = player_row.formatted_name
  }

  // Never record an alias equal to the canonical name.
  if (formatted_alias === canonical_name) {
    return 0
  }

  const existing = await db('player_aliases')
    .where({ pid, formatted_alias })
    .first()
  if (existing) {
    return 0
  }

  await db('player_aliases').insert({ pid, formatted_alias, source })
  log(`added alias "${formatted_alias}" for ${pid} (source: ${source})`)
  return 1
}

export default ensure_player_alias
