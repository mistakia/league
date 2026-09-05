import db from '#db'

// Held as strings rather than built per call site because each has to appear
// identically in three places -- the select, the WHERE expression and the sort
// expression. A select and a filter that disagree on the fallback would filter
// on one value and display another, with no error to notice.
const CANONICAL_COVERAGE_TYPE = `COALESCE(nfl_plays.coverage_type::text, CASE WHEN nfl_plays.coverage_type_ngs = '2_MAN' THEN 'COVER_2_MAN' ELSE nfl_plays.coverage_type_ngs END)`

const COVERAGE_SOURCE = `CASE WHEN nfl_plays.coverage_type IS NOT NULL THEN 'charted' WHEN nfl_plays.coverage_type_ngs IS NOT NULL THEN 'next_gen_stats' END`

const CANONICAL_MAN_ZONE = `CASE nfl_plays.man_zone WHEN 'MAN' THEN 'MAN_COVERAGE' WHEN 'ZONE' THEN 'ZONE_COVERAGE' ELSE nfl_plays.man_zone END`

export default {
  play_is_play_action: {
    column_name: 'is_play_action',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_play_action as play_is_play_action'],
    main_where: () => 'nfl_plays.is_play_action',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_play_action = true THEN 1 ELSE 0 END) as play_is_play_action'
      ),
    use_having: true
  },
  play_is_no_huddle: {
    column_name: 'is_no_huddle',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_no_huddle as play_is_no_huddle'],
    main_where: () => 'nfl_plays.is_no_huddle',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_no_huddle = true THEN 1 ELSE 0 END) as play_is_no_huddle'
      ),
    use_having: true
  },
  play_is_screen: {
    column_name: 'is_screen_pass',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_screen_pass as play_is_screen'],
    main_where: () => 'nfl_plays.is_screen_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_screen_pass = true THEN 1 ELSE 0 END) as play_is_screen'
      ),
    use_having: true
  },
  play_is_qb_scramble: {
    column_name: 'is_qb_scramble',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_qb_scramble as play_is_qb_scramble'],
    main_where: () => 'nfl_plays.is_qb_scramble',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_qb_scramble = true THEN 1 ELSE 0 END) as play_is_qb_scramble'
      ),
    use_having: true
  },
  play_is_qb_dropback: {
    column_name: 'is_qb_dropback',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_qb_dropback as play_is_qb_dropback'],
    main_where: () => 'nfl_plays.is_qb_dropback',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_qb_dropback = true THEN 1 ELSE 0 END) as play_is_qb_dropback'
      ),
    use_having: true
  },
  play_is_qb_rush: {
    column_name: 'is_qb_rush',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_qb_rush as play_is_qb_rush'],
    main_where: () => 'nfl_plays.is_qb_rush',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_qb_rush = true THEN 1 ELSE 0 END) as play_is_qb_rush'
      ),
    use_having: true
  },
  play_is_blitz: {
    column_name: 'is_blitz',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_blitz as play_is_blitz'],
    main_where: () => 'nfl_plays.is_blitz',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_blitz = true THEN 1 ELSE 0 END) as play_is_blitz'
      ),
    use_having: true
  },
  play_is_zero_blitz: {
    column_name: 'is_zero_blitz',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_zero_blitz as play_is_zero_blitz'],
    main_where: () => 'nfl_plays.is_zero_blitz',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_zero_blitz = true THEN 1 ELSE 0 END) as play_is_zero_blitz'
      ),
    use_having: true
  },
  play_is_stunt: {
    column_name: 'is_stunt',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_stunt as play_is_stunt'],
    main_where: () => 'nfl_plays.is_stunt',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_stunt = true THEN 1 ELSE 0 END) as play_is_stunt'
      ),
    use_having: true
  },
  play_coverage_defenders: {
    column_name: 'coverage_defenders',
    table_name: 'nfl_plays',
    main_select: () => [
      'nfl_plays.coverage_defenders as play_coverage_defenders'
    ],
    main_where: () => 'nfl_plays.coverage_defenders',
    aggregate_select: () =>
      db.raw('AVG(nfl_plays.coverage_defenders) as play_coverage_defenders'),
    use_having: true
  },
  // ONE canonical coverage column over two feeds, and one companion naming
  // which feed answered.
  //
  // nfl_plays carries the shell twice: `coverage_type`, our own charting, which
  // starts in 2023; and `coverage_type_ngs`, the Next Gen Stats classification,
  // which runs back to 2018. Exposing both as columns would make a season-range
  // view ask two different questions and make a user pick a feed to get a full
  // history, so the canonical column prefers our charting and falls back to Next
  // Gen Stats. Measured 2026-09-04 over the 2018-2026 dropbacks: the fallback is
  // what carries 2018-2022 at all (charting supplies 0 there), and it lifts a
  // charted-only 2023 from 18,254 to 20,399 covered dropbacks.
  //
  // The vocabularies differ by exactly one member -- Next Gen Stats spells
  // two-man `2_MAN` where our charting spells it `COVER_2_MAN` -- so the
  // fallback arm rewrites that one value rather than letting the same shell sit
  // under two filter options.
  //
  // WHY THE SOURCE COLUMN IS NOT OPTIONAL. Where BOTH feeds classify the same
  // play they disagree on 20,791 of 55,326 (37.6%, measured 2026-09-04), so the
  // canonical value is a preference, not a consensus, and a view spanning 2022
  // and 2024 silently changes classifier mid-table. `play_coverage_source` makes
  // that visible and filterable, which is what lets a multi-season view hold the
  // classifier constant instead of trusting a blend.
  play_coverage_type: {
    column_name: 'coverage_type',
    table_name: 'nfl_plays',
    sort_column_name: CANONICAL_COVERAGE_TYPE,
    main_select: () => [
      db.raw(`${CANONICAL_COVERAGE_TYPE} as play_coverage_type`)
    ],
    main_where: () => CANONICAL_COVERAGE_TYPE
  },
  play_coverage_source: {
    column_name: 'coverage_type',
    table_name: 'nfl_plays',
    sort_column_name: COVERAGE_SOURCE,
    main_select: () => [db.raw(`${COVERAGE_SOURCE} as play_coverage_source`)],
    main_where: () => COVERAGE_SOURCE
  },
  // Same shape one level down: the man/zone call arrives in two spellings for
  // the same distinction -- `MAN_COVERAGE`/`ZONE_COVERAGE` from the Next Gen
  // Stats feed since 2018, and `MAN`/`ZONE` from our charting on part of 2025
  // onward. Both are live within a single season (2025: 20,116 long, 22,677
  // short), so a filter on either raw spelling alone answers roughly half a
  // recent season and reports nothing about the half it missed. The column
  // normalizes to the long spelling; `SITUATIONAL` and `MISC` have no long
  // equivalent and pass through as themselves.
  play_man_zone: {
    column_name: 'man_zone',
    table_name: 'nfl_plays',
    sort_column_name: CANONICAL_MAN_ZONE,
    main_select: () => [db.raw(`${CANONICAL_MAN_ZONE} as play_man_zone`)],
    main_where: () => CANONICAL_MAN_ZONE
  },
  play_is_motion: {
    column_name: 'is_motion',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_motion as play_is_motion'],
    main_where: () => 'nfl_plays.is_motion',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_motion = true THEN 1 ELSE 0 END) as play_is_motion'
      ),
    use_having: true
  },
  play_is_trick_play: {
    column_name: 'is_trick_play',
    table_name: 'nfl_plays',
    main_select: () => ['nfl_plays.is_trick_play as play_is_trick_play'],
    main_where: () => 'nfl_plays.is_trick_play',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_trick_play = true THEN 1 ELSE 0 END) as play_is_trick_play'
      ),
    use_having: true
  },
  play_is_out_of_pocket: {
    column_name: 'is_out_of_pocket_pass',
    table_name: 'nfl_plays',
    main_select: () => [
      'nfl_plays.is_out_of_pocket_pass as play_is_out_of_pocket'
    ],
    main_where: () => 'nfl_plays.is_out_of_pocket_pass',
    aggregate_select: () =>
      db.raw(
        'SUM(CASE WHEN nfl_plays.is_out_of_pocket_pass = true THEN 1 ELSE 0 END) as play_is_out_of_pocket'
      ),
    use_having: true
  }
}
