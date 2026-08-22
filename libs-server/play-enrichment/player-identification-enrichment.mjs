import debug from 'debug'

import getPlayFromPlayStats from '#libs-shared/get-play-from-play-stats.mjs'
import { group_play_stats_by_play } from './enrichment-helpers.mjs'

const log = debug('play-enrichment:player-identification')

/**
 * Enriches plays with player identifications by mapping GSIS IDs to internal PIDs
 *
 * Processes play_stats to extract GSIS IDs for all player roles:
 * - Ball carrier (ball_carrier_pid)
 * - Passer (passer_pid)
 * - Target receiver (target_pid)
 * - Interceptor (interceptor_pid)
 * - Fumbler (fumble_lost_pid)
 * - Solo tacklers (tacklers_solo arrays)
 * - Tacklers with assists (tacklers_with_assisters arrays)
 * - Tackle assisters (tackle_assisters arrays)
 *
 * @param {object[]} plays - Array of play objects with esbid and play_id
 * @param {object[]} play_stats - Array of play stat objects with GSIS IDs
 * @param {object} player_cache - Player cache instance with find_player method
 * @param {Map<number, Map<string, object[]>>} [snap_roster_by_esbid] - Optional week-accurate participation
 *   index: esbid -> Map(normalized player name -> [{ pid, gsisid }]) built from
 *   nfl_snaps (who was on the field that game). Enables the source-NULL-gsisId
 *   fallback below.
 * @returns {object[]} Plays with all player _pid fields populated
 */
export const enrich_player_identifications = (
  plays,
  play_stats,
  player_cache,
  snap_roster_by_esbid = null
) => {
  // Group play_stats by play for efficient lookup
  const play_stats_by_play = group_play_stats_by_play(play_stats)

  log(`Processing player identifications for ${plays.length} plays`)

  let enriched_count = 0
  let skipped_count = 0
  let fallback_resolved_count = 0
  let play_row_resolved_count = 0
  const missing_gsis_ids = new Set()

  const normalize_name = (value) =>
    (value || '').toString().trim().toLowerCase()

  // Source-NULL-gsisId fallback: the NFL feed sometimes emits a role stat row
  // (e.g. statId 10/11 for the ball carrier) carrying playerName + clubCode but
  // a NULL gsisId, so play_data has no gsis to map. Recover the actor from the
  // week-accurate snap roster: the player who (a) was on the field in this exact
  // game and (b) whose name matches the stat row's playerName. Unique-or-abstain
  // -- a name shared by two snap participants resolves to nothing rather than
  // guessing. This writes only the owned nfl_plays._gsis/_pid columns; it never
  // mutates the NFL-owned nfl_play_stats row. See
  // user:text/league/data-quality-and-validation.md.
  const resolve_role_gsis_via_snap_roster = (
    stats_for_play,
    stat_ids,
    esbid
  ) => {
    if (!snap_roster_by_esbid) return null
    const roster = snap_roster_by_esbid.get(esbid)
    if (!roster) return null
    const stat = stats_for_play.find(
      (s) =>
        stat_ids.includes(s.stat_id) &&
        s.player_name &&
        s.player_name.trim() !== ''
    )
    if (!stat) return null
    const candidates = roster.get(normalize_name(stat.player_name)) || []
    const gsisids = [
      ...new Set(candidates.map((c) => c.gsisid).filter(Boolean))
    ]
    return gsisids.length === 1 ? gsisids[0] : null
  }

  // Legacy mapper for penalty role only: getPlayFromPlayStats case 93 is
  // empty so penalty_player_gsis has no play_stats source, and we keep the
  // play-row OR-fallback + pid early-return. See user:text/league/data-quality-and-validation.md.
  const map_player_field = (
    enriched_play,
    play_data,
    gsis_field,
    pid_field
  ) => {
    const gsis = play_data[gsis_field] || enriched_play[gsis_field]
    if (!gsis) return false
    if (enriched_play[pid_field]) return true

    const player = player_cache.find_player({
      gsis_player_id: gsis,
      ignore_free_agent: false,
      ignore_retired: false
    })
    if (player) {
      enriched_play[pid_field] = player.pid
      return true
    }

    missing_gsis_ids.add(gsis)
    return false
  }

  // Owned single-player writer for bc/psr/trg/intp/fuml. Writes _gsis and
  // _pid in lockstep from play_data (no early-return when _pid is already set
  // -- the reattribution clear path depends on overwriting whatever was
  // there).
  //
  // Three states, not two. allow_play_row_resolution is set by the caller when
  // the family's statIds are ABSENT from the feed for this play, which is a
  // different fact from the feed naming the role and leaving it empty:
  //
  //   1. play_data carries a gsis -> write {_gsis, _pid} in lockstep. The feed
  //      spoke; it is the source of truth and overwrites whatever was there.
  //   2. play_data carries nothing, the family's statIds are absent, and the
  //      play row already holds a _gsis -> RESOLVE it to a _pid and preserve
  //      both. The feed never spoke about this role, so the play-row value is
  //      attribution we already hold rather than one the feed retracted.
  //   3. otherwise -> NULL-clear both.
  //
  // State 2 is the correction. Treating a family's missing statIds as "the
  // role was not occupied" erased the passer on every penalty-nullified (NOPL)
  // and two-point (CONV) pass, where a real pass was thrown -- the play text
  // names the passer -- but the stat ledger books it outside the passing
  // families. Role _pid is ATTRIBUTION (who); whether a play counts toward a
  // stat is a separate, explicit predicate. See
  // user:task/league/separate-play-role-attribution-from-countability.md.
  //
  // Deliberately NOT applied when the family's statIds ARE present but carry
  // no gsisId: there the feed spoke about the role and named nobody, so the
  // clear is a real retraction, and resolve_role_gsis_via_snap_roster above is
  // the recovery path for it. State 2 also never writes a NULL over an
  // existing value -- an unresolvable _gsis leaves an already-set _pid alone.
  const map_owned_player_field = (
    enriched_play,
    play_data,
    gsis_field,
    pid_field,
    allow_play_row_resolution = false
  ) => {
    const gsisid = play_data[gsis_field] || null
    if (gsisid) {
      enriched_play[gsis_field] = gsisid
      const player = player_cache.find_player({
        gsis_player_id: gsisid,
        ignore_free_agent: false,
        ignore_retired: false
      })
      if (player) {
        enriched_play[pid_field] = player.pid
      } else {
        enriched_play[pid_field] = null
        missing_gsis_ids.add(gsisid)
      }
    } else if (allow_play_row_resolution && enriched_play[gsis_field]) {
      const play_row_gsis = enriched_play[gsis_field]
      if (!enriched_play[pid_field]) {
        const player = player_cache.find_player({
          gsis_player_id: play_row_gsis,
          ignore_free_agent: false,
          ignore_retired: false
        })
        if (player) {
          enriched_play[pid_field] = player.pid
          play_row_resolved_count++
        } else {
          missing_gsis_ids.add(play_row_gsis)
        }
      }
    } else {
      enriched_play[gsis_field] = null
      enriched_play[pid_field] = null
    }
  }

  // Owned-family tackle slot writer. Always returns true so callers count
  // the family as enriched even when every slot resolves to null (the act
  // of running the owned write is the contract, not a successful pid).
  const map_owned_tackle_array = (
    enriched_play,
    gsis_array,
    field_prefix,
    max_count
  ) => {
    const source = gsis_array || []
    for (let i = 0; i < max_count; i++) {
      const slot = i + 1
      const gsis_field = `${field_prefix}_${slot}_gsis`
      const pid_field = `${field_prefix}_${slot}_pid`
      const gsisid = source[i] || null
      if (gsisid) {
        enriched_play[gsis_field] = gsisid
        const player = player_cache.find_player({
          gsis_player_id: gsisid,
          ignore_free_agent: false,
          ignore_retired: false
        })
        if (player) {
          enriched_play[pid_field] = player.pid
        } else {
          enriched_play[pid_field] = null
          missing_gsis_ids.add(gsisid)
        }
      } else {
        enriched_play[gsis_field] = null
        enriched_play[pid_field] = null
      }
    }
    return true
  }

  // Owned single-player families: each entry's statIds gate ownership.
  // When has_any_play_stats is true, the family is owned: if any statId in
  // the set is present, write {_gsis, _pid} from play_data; otherwise fall to
  // map_owned_player_field's play-row resolution state, which preserves an
  // existing _gsis and NULL-clears only when there is nothing to preserve.
  // Penalty is excluded because getPlayFromPlayStats case
  // 93 is empty -- it stays on the legacy map_player_field path below.
  // Each family's stat_ids gate MUST mirror the full set of statIds that
  // getPlayFromPlayStats uses to populate the family's _gsis field. A gate
  // narrower than that set silently stops the feed's own attribution from
  // reaching the role on plays whose only evidence is an omitted statId (see
  // below), leaving whatever the play row already held. Keep these in lockstep with
  // libs-shared/get-play-from-play-stats.mjs.
  const owned_single_player_families = [
    {
      gsis: 'ball_carrier_gsis_player_id',
      pid: 'ball_carrier_pid',
      stat_ids: [10, 11]
    },
    // passer_gsis_player_id is set by statIds 14/15/16 (incomplete/complete/TD passes), 19
    // (interception), 20 (sack, 2023+ feed omits 14/15/16), and 111/112 (air
    // yards complete/incomplete). Omitting 19 wiped the passer on every
    // interception; omitting 111/112 wiped air-yards-only pass rows.
    {
      gsis: 'passer_gsis_player_id',
      pid: 'passer_pid',
      stat_ids: [14, 15, 16, 19, 20, 111, 112]
    },
    // target_gsis_player_id is set by statIds 21/22 (reception/TD), 113 (yards after catch),
    // and 115 (target/intended receiver -- the ONLY target stat present on
    // incompletions). Omitting 113/115 collapsed targets-from-plays to
    // receptions, since incomplete-pass targets carry only statId 115.
    {
      gsis: 'target_gsis_player_id',
      pid: 'target_pid',
      stat_ids: [21, 22, 113, 115]
    },
    {
      gsis: 'interceptor_gsis_player_id',
      pid: 'interceptor_pid',
      stat_ids: [25, 26]
    },
    {
      gsis: 'fumble_lost_gsis_player_id',
      pid: 'fumble_lost_pid',
      stat_ids: [52, 53, 54, 106]
    }
  ]

  const enriched_plays = plays.map((play) => {
    const play_key = `${play.esbid}-${play.play_id}`
    const stats_for_play = play_stats_by_play.get(play_key)
    const has_any_play_stats = Boolean(
      stats_for_play && stats_for_play.length > 0
    )

    const play_data = has_any_play_stats
      ? getPlayFromPlayStats({ playStats: stats_for_play })
      : {}

    // Create enriched play object with all existing fields
    const enriched_play = { ...play }

    // Track if we enriched any player field
    let has_player_data = false

    // Penalty (legacy path): play-stats has no penalty_player_gsis source,
    // so the OR-fallback against the play row stays.
    if (
      map_player_field(
        enriched_play,
        play_data,
        'penalty_player_gsis',
        'penalty_player_pid'
      )
    ) {
      has_player_data = true
    }

    // Owned single-player and tackle families are gated on has_any_play_stats:
    // zero play_stats is the live-game window where we must not clear stale
    // attribution.
    if (has_any_play_stats) {
      // statId 79 -> tacklers_solo, 80 -> tacklers_with_assisters,
      // 82 -> tackle_assisters.
      map_owned_tackle_array(
        enriched_play,
        play_data.tacklers_solo,
        'solo_tackle',
        3
      )
      map_owned_tackle_array(
        enriched_play,
        play_data.tacklers_with_assisters,
        'assisted_tackle',
        2
      )
      map_owned_tackle_array(
        enriched_play,
        play_data.tackle_assisters,
        'tackle_assist',
        4
      )

      // Single-player owned families: per-family stat-id presence drives
      // whether play_data carries the role's gsis, and -- when it does not --
      // whether the owned writer may resolve from the play row instead of
      // NULL-clearing.
      for (const family of owned_single_player_families) {
        const has_family_stats = stats_for_play.some((s) =>
          family.stat_ids.includes(s.stat_id)
        )
        let family_play_data = has_family_stats ? play_data : {}

        // The feed gave us a role stat row but omitted its gsisId: try the
        // week-accurate snap-roster fallback before the owned writer would
        // NULL-clear the role. Inject the recovered gsis into a shallow copy
        // so pid resolution + missing-gsis tracking proceed unchanged.
        if (
          has_family_stats &&
          !family_play_data[family.gsis] &&
          snap_roster_by_esbid
        ) {
          const fallback_gsis = resolve_role_gsis_via_snap_roster(
            stats_for_play,
            family.stat_ids,
            play.esbid
          )
          if (fallback_gsis) {
            family_play_data = {
              ...family_play_data,
              [family.gsis]: fallback_gsis
            }
            fallback_resolved_count++
          }
        }

        // The family's statIds being absent entirely is what licenses the
        // play-row resolution state -- see map_owned_player_field.
        map_owned_player_field(
          enriched_play,
          family_play_data,
          family.gsis,
          family.pid,
          !has_family_stats
        )
      }

      has_player_data = true
    }

    if (has_player_data) {
      enriched_count++
    } else {
      skipped_count++
    }

    return enriched_play
  })

  log(
    `Player identification enrichment: ${enriched_count} enriched, ${skipped_count} skipped` +
      (fallback_resolved_count
        ? `, ${fallback_resolved_count} resolved via snap-roster fallback (source NULL gsisId)`
        : '') +
      (play_row_resolved_count
        ? `, ${play_row_resolved_count} resolved from an existing play-row _gsis (family statIds absent)`
        : '')
  )

  if (missing_gsis_ids.size > 0) {
    log(
      `Missing GSIS IDs (${missing_gsis_ids.size}): ${Array.from(missing_gsis_ids).slice(0, 10).join(', ')}${missing_gsis_ids.size > 10 ? '...' : ''}`
    )
  }

  return enriched_plays
}
