// @ts-check
import db from '#db'
import { current_season } from '#constants'
import { create_default_league, epoch_to_timestamptz } from '#libs-shared'
import {
  get_open_league_pause,
  get_latest_league_resume
} from './league-pause.mjs'

/**
 * The league object 32 consumers destructure.
 *
 * It is the four joined rows merged flat, plus two computed groups, which is
 * why no single table type describes it: `leagues` left-joined to `seasons`,
 * `league_formats` and `league_scoring_formats`, then the division-name map
 * and the pause state spread over the top. The row types are DERIVED from
 * db/schema.postgres.sql (db/tools/generate-schema-types.mjs), so a column
 * that a rename moves out from under a consumer becomes a type error here
 * rather than an `undefined` that reads as "not configured".
 *
 * The `Partial` on the three joined sides is not laziness -- these are LEFT
 * joins, so a league with no `seasons` row for the requested year genuinely
 * carries none of those keys, and typing them as present would assert
 * something the query does not guarantee.
 *
 * @typedef {Omit<import('#db/schema-types.js').LeaguesRow, DefaultLeagueAbsentColumn>
 *   & Partial<Pick<import('#db/schema-types.js').LeaguesRow, DefaultLeagueAbsentColumn>>
 *   & Partial<import('#db/schema-types.js').SeasonsRow>
 *   & Partial<import('#db/schema-types.js').LeagueFormatsRow>
 *   & Partial<import('#db/schema-types.js').LeagueScoringFormatsRow>
 *   & LeagueDivisionNames
 *   & LeaguePauseState} League
 */

/**
 * The `leagues` columns the SYNTHETIC lid=0 league does not carry.
 *
 * `create_default_league()` supplies league configuration, not a `leagues`
 * row: of that table's 14 columns it produces three, and the `lid=0` branch
 * below adds `league_id`. The ten named here are therefore `undefined` on the
 * default league and present on every real one — which is exactly the
 * absent-key shape that has repeatedly reached production through the SPA's
 * Immutable `Record`, so it is recorded in the type rather than left for a
 * consumer to discover as a falsy value that reads like configuration.
 *
 * They are typed optional rather than fixed by widening
 * `create_default_league`, and that stays the ruling. Adding keys there is NOT
 * a safe local change, though not for the reason this comment gave until
 * 2026-08-19: `create-league.mjs` builds its `leagues` INSERT from an explicit
 * three-field allowlist, so nothing added here can reach that table. The
 * exposure is the SEASONS insert, which spreads `...league_params` wholesale —
 * so any key added to `create_default_league` lands in it and knex throws on
 * the unknown column. Making that spread an explicit allowlist is the
 * prerequisite for widening the default league, and it is its own change.
 *
 * @typedef {'discord_webhook_url'
 *   | 'is_hosted'
 *   | 'archived_at'
 *   | 'espn_league_id'
 *   | 'sleeper_league_id'
 *   | 'mfl_league_id'
 *   | 'fleaflicker_league_id'
 *   | 'salary_attribution_rule'
 *   | 'discord_announcements_webhook_url'
 *   | 'cloned_from_league_id'} DefaultLeagueAbsentColumn
 */

/**
 * Division names arrive as computed keys (`division_1_name`, ...), so the
 * shape is keyed by pattern rather than by a fixed key set -- the division
 * count is league configuration, not a constant.
 *
 * The key is a TEMPLATE pattern rather than a bare `[key: string]` index
 * signature. A bare one would claim every key on the merged league object and
 * force all 120 of them to be strings, which both fails here and would silently
 * accept any misspelled read. This is the interpolated-key class the census
 * ranks at four occurrences and calls invisible by construction: there is no
 * literal to grep, so the pattern in the type is the only thing that states it.
 *
 * @typedef {{ [division_name_key: `division_${number}_name`]: string | undefined }} LeagueDivisionNames
 */

/**
 * @typedef {object} LeaguePauseState
 * @property {Date | null} paused_at
 * @property {Date | null} resumed_at
 */

/**
 * @param {object} params
 * @param {number} params.lid
 * @param {number} params.year
 * @returns {Promise<LeagueDivisionNames>}
 */
async function get_league_divisions({ lid, year }) {
  const divisions = await db('league_divisions')
    .where({ lid, season_year: year })
    .select('division_id', 'division_name')

  return divisions.reduce((acc, div) => {
    acc[`division_${div.division_id}_name`] = div.division_name
    return acc
  }, /** @type {LeagueDivisionNames} */ ({}))
}

/**
 * @param {object} [params]
 * @param {number | string} [params.lid]
 * @param {number | string} [params.year]
 * @returns {Promise<League | undefined>}
 */
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
    return {
      league_id: 0,
      ...league,
      // `create_default_league` is a SEED payload for the write path, where
      // `create-league.mjs` runs this field through `epoch_to_timestamptz`
      // before binding it. Reading it back out here skipped that conversion,
      // so `trade_deadline_at` was epoch SECONDS on the synthetic lid=0 league
      // and a `Date` on every real one — one field name, two units, decided by
      // which branch the caller landed in.
      //
      // Neither consumer can tell them apart: `dayjs(1606626000)` reads the
      // number as MILLISECONDS and yields 1970-01-19 rather than 2020-11-29,
      // and it neither throws nor produces an invalid date, so the trade
      // deadline simply reads as long past. That is the mixed-unit residue of
      // the 2026-08-07 timestamptz retype, surfaced by the type checker rather
      // than by any consumer.
      trade_deadline_at: epoch_to_timestamptz(league.trade_deadline_at)
    }
  }

  const league = await db('leagues')
    .leftJoin('seasons', function () {
      this.on('leagues.league_id', '=', 'seasons.lid')
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
    .where('leagues.league_id', lid)
    .first()

  if (league) {
    const divisions = await get_league_divisions({ lid, year })
    const pause_state = await get_league_pause_state({ lid })
    // The assertion is the index signature, not the columns. TypeScript drops
    // an index signature when its source is spread into an object literal, so
    // the division-name keys `divisions` carries cannot survive into the
    // literal's inferred type no matter how the spread is written. Everything
    // else here is checked structurally: `league` is the joined row types, and
    // any column the schema renames still fails at the consumer.
    return /** @type {League} */ ({ ...league, ...divisions, ...pause_state })
  }

  // Reaching here means `.first()` found no row. Returning `league` itself
  // would be the same value but claims the row type, which is what the
  // `League` return contract then has to reconcile against a missing league.
  return undefined
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
 *
 * @param {object} params
 * @param {number} params.lid
 * @returns {Promise<LeaguePauseState>}
 */
async function get_league_pause_state({ lid }) {
  const open_pause = await get_open_league_pause({ league_id: lid })
  const resumed_at = await get_latest_league_resume({ league_id: lid })

  return {
    paused_at: open_pause ? open_pause.paused_at : null,
    resumed_at
  }
}
