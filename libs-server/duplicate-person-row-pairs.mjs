// @ts-check
import db from '#db'

/*
  The population behind the `duplicate-person-rows` check: one person occupying
  both a populated canonical `player` row and a near-empty shell row.

  Shared by the check that FINDS the class (db/checks/registry.mjs) and the
  repair that CLOSES it (scripts/merge-duplicate-person-rows.mjs), because the
  two drifting apart is this class's documented failure mode -- round 4's
  hand-written column list named three columns a later conform had renamed away
  and silently dropped every column added since. A repair that selects a
  different population than the check reports does not clear the finding, and
  nothing says so.

  A pair here is a CANDIDATE for adjudication, never an automatic merge: fathers,
  sons and namesakes sit in the same predicate, and 17 of the 43 pairs standing
  when this was written are parked as genuinely different people. The
  discrimination lives in the repair, not here.
*/

/*
  Every external identifier column on `player`. A shell row is one holding NONE
  of them. Enumerated rather than derived from information_schema at runtime: a
  derived list silently changes the predicate's meaning when a column is added,
  which is the same class of defect as a registry-derived CTE identity key.
*/
export const PLAYER_EXTERNAL_ID_COLUMNS = [
  'cbs_player_id',
  'cfbref_player_id',
  'draftkings_player_id',
  'esb_player_id',
  'espn_player_id',
  'fanduel_player_id',
  'fantasy_data_player_id',
  'fantasylabs_player_id',
  'fantasypoints_player_id',
  'fantrax_player_id',
  'ffpc_player_id',
  'fleaflicker_player_id',
  'gsis_it_player_id',
  'gsis_player_id',
  'keeptradecut_player_id',
  'mfl_player_id',
  'nffc_player_id',
  'nfl_player_id',
  'otc_player_id',
  'pff_player_id',
  'pfr_player_id',
  'rotowire_player_id',
  'rotoworld_player_id',
  'rts_player_id',
  'sis_player_id',
  'sleeper_player_id',
  'smart_player_id',
  'sportradar_player_id',
  'sumer_player_id',
  'swish_player_id',
  'underdog_player_id',
  'yahoo_player_id'
]

/*
  The twin must hold TWO or more identifiers. The threshold is load-bearing and
  was measured: requiring two gives 24 findings, requiring one gives 60, and the
  original round specifies two.
*/
const MINIMUM_TWIN_IDENTIFIER_COUNT = 2

const identifier_count_expression = (/** @type {string} */ alias) =>
  `num_nonnulls(${PLAYER_EXTERNAL_ID_COLUMNS.map((column) => `${alias}.${column}`).join(', ')})`

/**
 * Shell rows paired with the identified row that shares their name.
 *
 * A shell holds no external identifier and no gamelog; its twin holds at least
 * two identifiers and the same `formatted_name`, with colleges that agree or
 * where either side is unknown. One shell can appear more than once when two
 * rows both qualify as its twin.
 *
 * @returns {Promise<Array<Record<string, any>>>}
 */
export const find_duplicate_person_row_pairs = async () => {
  const { rows } = await db.raw(
    `with id_counts as (
       select p.pid, p.formatted_name, p.college,
              ${identifier_count_expression('p')} as id_count
       from player p
     ),
     shells as (
       select c.pid, c.formatted_name, c.college
       from id_counts c
       where c.id_count = 0
         and not exists (select 1 from player_gamelogs g where g.pid = c.pid)
     )
     select s.pid as shell_pid,
            s.formatted_name,
            k.pid as twin_pid,
            k.id_count as twin_identifier_count,
            shell_row.date_of_birth as shell_date_of_birth,
            shell_row.nfl_draft_year as shell_nfl_draft_year,
            shell_row.college as shell_college,
            shell_row.primary_position as shell_primary_position,
            twin_row.date_of_birth as twin_date_of_birth,
            twin_row.nfl_draft_year as twin_nfl_draft_year,
            twin_row.college as twin_college,
            twin_row.primary_position as twin_primary_position,
            twin_row.gsis_player_id as twin_gsis_player_id
     from shells s
     join id_counts k
       on k.formatted_name = s.formatted_name
      and k.pid <> s.pid
      and k.id_count >= ?
      and (k.college = s.college or k.college is null or s.college is null)
     join player shell_row on shell_row.pid = s.pid
     join player twin_row on twin_row.pid = k.pid
     order by s.formatted_name, s.pid, k.pid`,
    [MINIMUM_TWIN_IDENTIFIER_COUNT]
  )
  return rows
}
