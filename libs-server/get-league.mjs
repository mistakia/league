import db from '#db'
import { current_season } from '#constants'
import { create_default_league } from '#libs-shared'
import {
  get_open_league_pause,
  get_latest_league_resume
} from './league-pause.mjs'

async function get_league_divisions({ lid, year }) {
  const divisions = await db('league_divisions')
    .where({ lid, season_year: year })
    .select('division_id', 'division_name')

  return divisions.reduce((acc, div) => {
    acc[`division_${div.division_id}_name`] = div.division_name
    return acc
  }, {})
}

export default async function ({ lid, year = current_season.year } = {}) {
  lid = Number(lid)

  // `year` is spliced into the join predicate below as raw SQL, so it gets the
  // same coercion `lid` already has. Callers reach this from request input --
  // notably the unauthenticated data-view search route, via the league roster
  // join -- and an uncoerced year was a live injection path.
  const parsed_year = Number(year)
  year = Number.isInteger(parsed_year) ? parsed_year : current_season.year

  if (!lid) {
    const league = create_default_league()
    return { uid: 0, ...league }
  }

  const league = await db('leagues')
    .leftJoin('seasons', function () {
      this.on('leagues.uid', '=', 'seasons.lid')
      this.on(
        db.raw(`seasons.season_year = ${year} or seasons.season_year is null`)
      )
    })
    .leftJoin('league_formats', 'seasons.league_format_id', 'league_formats.id')
    .leftJoin(
      'league_scoring_formats',
      'seasons.scoring_format_id',
      'league_scoring_formats.id'
    )
    .where('leagues.uid', lid)
    .first()

  if (league) {
    const divisions = await get_league_divisions({ lid, year })
    const pause_state = await get_league_pause_state({ lid })
    return { ...league, ...divisions, ...pause_state }
  }

  return league
}

/**
 * The league's pause state, for the banner and the rookie draft clock.
 *
 * **`pause_reason` is deliberately NOT attached here.** `GET /leagues/:leagueId`
 * and `GET /:leagueId/seasons/:year` both mount above the blanket 401 in
 * `api/index.mjs`, and this function is also reached by the unauthenticated
 * data-view search route through the league roster join — so anything attached
 * here is readable by an anonymous caller. The commissioner's free-text reason
 * is served from the authenticated pause route instead. That is the same leak
 * the 423 body already takes care to avoid, and it would otherwise arrive
 * through the wire.
 *
 * `is_paused` is not sent either: it is `Boolean(paused_at)` at the one
 * component that needs it, and a second field is a second thing to disagree.
 *
 * `paused_at` travels because the SPA freezes its whole display clock off it
 * (`libs-shared/get-draft-clock-now.mjs`), so a live pause holds every countdown
 * still instead of ticking it down and jumping it backward on the next refetch.
 * `resumed_at` travels because it is what voids the draft's standing
 * publication: without it the SPA would render windows from a slate the resume
 * already cancelled.
 */
async function get_league_pause_state({ lid }) {
  const open_pause = await get_open_league_pause({ league_id: lid })
  const resumed_at = await get_latest_league_resume({ league_id: lid })

  return {
    paused_at: open_pause ? open_pause.paused_at : null,
    resumed_at
  }
}
