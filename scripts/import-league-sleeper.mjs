import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, createLeague } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-league-sleeper')
debug.enable('import-league-sleeper')

const formatLeague = (data) => ({
  name: data.name,
  nteams: data.total_rosters,
  sqb: data.roster_positions.filter(p => p === 'QB').length,
  srb: data.roster_positions.filter(p => p === 'RB').length,
  swr: data.roster_positions.filter(p => p === 'WR').length,
  ste: data.roster_positions.filter(p => p === 'TE').length,
  srbwr: data.roster_positions.filter(p => p === 'WRRB_FLEX').length,
  srbwrte: data.roster_positions.filter(p => p === 'FLEX').length,
  sqbrbwrte: data.roster_positions.filter(p => p === 'SUPER_FLEX').length,
  swrte: data.roster_positions.filter(p => p === 'REC_FLEX').length,
  sdst: data.roster_positions.filter(p => p === 'DEF').length,,
  sk: data.roster_positions.filter(p => p === 'K').length,,
  bench: data.roster_positions.filter(p => p === 'BN').length,,
  ps: null,
  ir: data.settings.reserve_slots,
  mqb: data.settings.position_limit_qb || 0,
  mrb: data.settings.position_limit_rb || 0,
  mwr: data.settings.position_limit_wr || 0,
  mte: data.settings.position_limit_te || 0,
  mdst: data.settings.position_limit_k || 0,
  mk: data.settings.position_limit_dst || 0,
  faab: data.settings.waiver_budget,
  cap: null,
  pa: data.scoring_settings.pass_att || 0,
  pc: data.scoring_settings.pass_cmp || 0,
  py: data.scoring_settings.pass_yd || 0,
  ints: data.scoring_settings.pass_int || 0,
  tdp: data.scoring_settings.pass_td || 0,
  ra: data.scoring_settings.rush_att || 0,
  ry: data.scoring_settings.rush_yd || 0,
  tdr: data.scoring_settings.rush_td || 0,
  rec: data.scoring_settings.rec || 0,
  rbrec: (data.scoring_settings.rec + (data.scoring_settings.bonus_rec_rb || 0)) || 0,
  wrrec: (data.scoring_settings.rec + (data.scoring_settings.bonus_rec_wr || 0)) || 0,
  terec: (data.scoring_settings.rec + (data.scoring_settings.bonus_rec_te || 0)) || 0,
  recy: data.scoring_settings.rec_yd || 0,
  twoptc: data.scoring_setting.pass_2pt, // TODO split stat into pass, rush, rec
  tdrec: data.scoring_setting.rec_td || 0,
  fuml: data.scoring_setting.fum_lost || 0, // TODO separate fumble and fumble lost
  krtd: data.scoring_setting.st_td || 0,
  prtd: data.scoring_setting.st_td || 0,
  draft_start: null,
  adate: null,
  minBid: 0,
  tddate: null // TODO: convert week trade_deadline into unix timestamp
})

const importLeagueSleeper = async ({ lid, league_sleeper_id }) => {
  const sleeper_league_data = await sleeper.getLeague({ league_sleeper_id })
  log(data)

  const { league, season } = formatLeague(sleeper_league_data)

  await db('leagues').update(league).where({ uid: lid})
  await db('seasons').update(season).where({ lid, year: sleeper_league_data.season })

  const sleeper_league_users = await sleeper.getLeagueUsers({ league_sleeper_id })
  const sleeper_league_rosters = await sleeper.getLeagueRosters({ league_sleeper_id })

  const rosters = []
  const teams = []

  for (const sleeper_roster of sleeper_league_rosters) {
    const sleeper_player_ids = sleeper_roster.players
    const sleeper_team = sleeper_league_users.find(u => u.user_id === sleeper_roster.owner_id)
    teams.push({
      lid,
      div: 1,
      name: sleeper_team.metadata.team_name,
      abbrv: null, // TODO
      image: sleeper_team.metadata.avatar,
      cap: null,
      faab: league.faab - sleeper_roster.settings.waiver_budget_used,
      do: null,
      wo: sleeper_roster.settings.waiver_position,
      pc: null,
      ac: null
    })

    rosters.push({
      tid, // TODO
      lid,
      week: constants.season.week,
      year: constants.season.year
    })

    rosters_players.push({
      rid, // TODO,
      slot: constants.slots.BENCH,
      pid, // TODO
      pos // TODO
    })
  }

  const matchups = []
  for (let week = 1; week < 18; week++) {
    const d = await sleeper.getLeagueMatchups({ league_sleeper_id, week })
    const matchups_by_id = groupby(d, 'matchup_id')
    for (const [matchup_id, matchups] of Object.entries(matchups_by_id)) {
      matchups.push({
        lid,
        aid, // todo
        hid, // todo
        hp, // todo
        ap, // todo
      })

      // todo save weekly roster
    }
  }

  // TODO - generate team_stats inserts
  // TODO - iterate through previous seasons
}

const main = async () => {
  let error
  try {
    await importLeagueSleeper()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default importLeagueSleeper
