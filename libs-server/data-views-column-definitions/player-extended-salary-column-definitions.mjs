import db from '#db'

import {
  current_season,
  player_tag_types,
  roster_slot_types,
  transaction_types
} from '#constants'
import { ASSET_TYPE } from '#libs-server/roster-asset-lineage/constants.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import get_join_func from '#libs-server/get-join-func.mjs'
import { get_single_value } from '#libs-server/data-views/param-utils.mjs'
import {
  create_static_cache_info,
  CACHE_TTL
} from '#libs-server/data-views/cache-info-utils.mjs'

// NOT static data, despite the helper's name. This column left-joins
// `roster_asset_holding`, which the lineage graph rewrites whenever a trade,
// release, extension or draft pick lands. It carried a 12-hour TTL until
// 2026-08-03, and nothing anywhere invalidates a data-view cache entry --
// `redis_cache.del` has two callers repo-wide, both in an unrelated auction
// script. So a response computed while the lineage graph was stale kept
// serving a $0 salary for a further 12 hours after the graph was corrected,
// stacking on top of the refresh lag rather than overlapping it.
//
// scripts/refresh-roster-asset-lineage.mjs cuts the staleness window to about
// a minute; this bounds how long a response captured inside that window can
// outlive it. Five minutes is chosen to sit above the poll interval plus a
// worst-case rebuild (~85s) with margin, so a cached entry is normally
// recomputed against a fresh graph rather than a rebuilding one.
const get_cache_info = create_static_cache_info({
  ttl: CACHE_TTL.FIVE_MINUTES
})

const ps_slots = [
  roster_slot_types.PS,
  roster_slot_types.PSP,
  roster_slot_types.PSD,
  roster_slot_types.PSDP
]

// Explicit column params arrive normalized to arrays, so both the alias and the
// join must unwrap before using either value in a scalar position.
const get_scope = ({ params = {} } = {}) => ({
  year: get_single_value(params.year, current_season.year),
  lid: get_single_value(params.lid, 1)
})

export const player_extended_salary_table_alias = ({ params = {} } = {}) => {
  const { lid, year } = get_scope({ params })
  return get_table_hash(`player_extended_salary_${lid}_${year}`)
}

// Whether the season's extensions have been PROCESSED, which is a database
// question and not a clock question. `scripts/process-extensions.mjs` runs on a
// */5 cron, so there is a window in which now is past `seasons.ext_date` and no
// extension transaction has been written yet. Keying the branch on the clock
// would understate every contract by its ladder step for the length of that
// window. See `libs-server/tag-board/build-tag-board.mjs` `post_deadline_salary`
// for the same predicate and the full reasoning.
const get_extensions_processed = async ({ lid, year }) => {
  const extension_row = await db('transactions')
    .where({ lid, year, type: transaction_types.EXTENSION })
    .first()

  return Boolean(extension_row)
}

export const player_extended_salary_join = async ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {},
  data_view_options = {}
} = {}) => {
  const join_func = get_join_func(join_type)
  const { lid, year } = get_scope({ params })

  const ps_slot_list = ps_slots.join(',')

  const extensions_processed = await get_extensions_processed({ lid, year })

  // Once the extensions are processed the stored salary IS the post-deadline
  // salary for every tag — applying the ladder again would compound it off an
  // already-extended base.
  //
  // A restricted free agency tag takes the REGULAR ladder, via the ELSE arm and
  // not an arm of its own. `process-extensions.mjs` is the writer of record here
  // and it coerces the tag to REGULAR before pricing (`process-extensions.mjs`
  // getExtensionAmount call), so a tag-4 player is charged
  // `salary_paid + (extensions + 1) * 5` at the deadline like any other
  // unextended contract — confirmed against league 1, where all 14 tag-4 players
  // carry a 2026 EXTENSION transaction at the ladder price and none at their
  // stored value. This column projects what that writer will do, so an arm
  // returning `salary_paid` here was a number production never charges.
  //
  // Removing it also closes a disclosure channel, which is why it must not come
  // back. A tag-4-only arm made the emitted salary differ by tag, and the tag is
  // private until the nomination is announced (see `player_league_roster_tag` in
  // data-views-column-definitions/index.mjs). Since the ladder adds at least $5,
  // `extended_salary = player_league_salary` held for a tagged player and for no
  // regular one, so differencing two public columns recovered the hidden tag
  // exactly. The window is real and annual: tags are applied through
  // `POST /teams/:teamId/tag` up until `ext_date`, and this branch is live for
  // precisely that period.
  const salary_expression = extensions_processed
    ? 'COALESCE(s.salary_paid, 0) AS extended_salary'
    : `CASE
          WHEN rp.slot IN (${ps_slot_list}) THEN COALESCE(s.salary_paid, 0)
          WHEN rp.tag = ${player_tag_types.FRANCHISE} THEN
            CASE rp.pos
              WHEN 'QB' THEN COALESCE(ssn.fqb, 0)
              WHEN 'RB' THEN COALESCE(ssn.frb, 0)
              WHEN 'WR' THEN COALESCE(ssn.fwr, 0)
              WHEN 'TE' THEN COALESCE(ssn.fte, 0)
              ELSE 0
            END
          WHEN rp.tag = ${player_tag_types.ROOKIE} THEN COALESCE(s.salary_paid, 0)
          ELSE COALESCE(s.salary_paid, 0) + (COALESCE(rp.extensions, 0) + 1) * 5
        END AS extended_salary`

  const subquery = db
    .select('rp.pid', db.raw(salary_expression))
    .from('rosters_players as rp')
    .leftJoin('roster_asset_holding as s', function () {
      this.on('s.player_id', '=', 'rp.pid')
        .andOn('s.lid', '=', 'rp.lid')
        .andOn('s.tid', '=', 'rp.tid')
        .andOn('s.asset_type', '=', db.raw('?', [ASSET_TYPE.PLAYER]))
        .andOnNull('s.period_end')
    })
    .where('rp.lid', lid)
    .where('rp.year', year)
    .where('rp.week', 0)

  // Only the projected branch reads the franchise tag prices off `seasons`.
  if (!extensions_processed) {
    subquery.leftJoin('seasons as ssn', function () {
      this.on('ssn.lid', '=', 'rp.lid').andOn('ssn.year', '=', 'rp.year')
    })
  }

  query[join_func](subquery.as(table_name), function () {
    this.on(`${table_name}.pid`, '=', data_view_options.pid_reference)
  })
}

export default {
  player_league_extended_salary: {
    column_name: 'extended_salary',
    table_name: 'player_extended_salary',
    table_alias: player_extended_salary_table_alias,
    join: player_extended_salary_join,
    source: { grain: 'player' },
    get_cache_info
  }
}
