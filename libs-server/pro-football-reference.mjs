import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import debug from 'debug'

import { constants, getGameDayAbbreviation, fixTeam } from '#libs-shared'
import { wait } from '#libs-server'
import * as cache from './cache.mjs'
import config from '#config'
import db from '#db'

const log = debug('pro-football-reference')

const format_time = (time_string) => {
  // Extract hours, minutes, and period from the time string
  const time_regex = /^(\d+):(\d+)(AM|PM)$/i
  const [, hours, minutes, period] = time_string.match(time_regex)

  // Convert hours to 24-hour format
  let formatted_hours = Number(hours)
  if (period.toUpperCase() === 'PM' && formatted_hours !== 12) {
    formatted_hours += 12
  } else if (period.toUpperCase() === 'AM' && formatted_hours === 12) {
    formatted_hours = 0
  }

  // Format the time in HH:mm:ss format
  const formatted_time = `${formatted_hours
    .toString()
    .padStart(2, '0')}:${minutes.padStart(2, '0')}:00`

  return formatted_time
}

const get_post_season_week_type = (week) => {
  switch (week) {
    case 'WildCard':
      return 'WC'

    case 'Division':
      return 'DIV'

    case 'ConfChamp':
      return 'CONF'

    case 'SuperBowl':
      return 'SB'

    default:
      return null
  }
}

const get_post_season_week_from_day = (day) => {
  switch (day) {
    case 'WC':
      return 1

    case 'DIV':
      return 2

    case 'CONF':
      return 3

    case 'SB':
      return 4
  }
}

const extract_position_start_end = (string) => {
  const regex = /\(([^)]*)\).+(\d{4})-(\d{4})$/
  const match = string.match(regex)

  if (!match) {
    log(`no match for ${string}`)
    return {
      positions: [],
      start: null,
      end: null
    }
  }

  const positions = match[1].split('-')
  const startYear = Number(match[2])
  const endYear = Number(match[3])

  return {
    positions,
    start: startYear,
    end: endYear
  }
}

const get_players_from_page = async ({ url, ignore_cache = false }) => {
  if (!url) {
    throw new Error('url is required')
  }

  log(`getting players from ${url} (ignore_cache: ${ignore_cache})`)

  const cache_key = `/pro-football-reference/players/${
    url.split('/').slice(-2)[0]
  }.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }
  }

  const response = await fetch(url)
  const text = await response.text()
  const dom = new JSDOM(text)
  const doc = dom.window.document
  const player_paragraph_divs = doc.querySelectorAll('#div_players p')
  const players = Array.from(player_paragraph_divs).map((div) => {
    const link = div.querySelector('a')
    const position_start_string = div.innerHTML.split('</a>')[1]
    const is_active = position_start_string.includes('</b>')

    return {
      name: link.textContent,
      url: link.href,
      is_active,
      pfr_id: link.href.split('/').slice(-1)[0].split('.')[0],
      ...extract_position_start_end(position_start_string)
    }
  })

  if (players.length) {
    await cache.set({ key: cache_key, value: players })
  }

  return players
}

const get_players_page_links = async ({ ignore_cache = false } = {}) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const cache_key = '/pro-football-reference/players-links.json'
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }
  }

  const url = `${config.pro_football_reference_url}/players/`
  const response = await fetch(url)
  const text = await response.text()
  const dom = new JSDOM(text)
  const doc = dom.window.document
  const links = doc.querySelectorAll('ul.page_index li > a')
  const hrefs = Array.from(links).map(
    (link) => `${config.pro_football_reference_url}${link.href}`
  )

  if (hrefs.length) {
    await cache.set({ key: cache_key, value: hrefs })
  }

  return hrefs
}

const get_starters = ({ doc, is_home }) => {
  const starters = []
  const starters_table = doc.querySelector(
    'table#' + (is_home ? 'home' : 'vis') + '_starters'
  )

  const rows = starters_table.querySelectorAll('tbody tr[data-row]')
  for (const row of rows) {
    const player_link = row.querySelector('td[data-stat="player"] a')
    const player_name = player_link.textContent
    const player_url = player_link.href
    const pfr_id = player_url.split('/').slice(-1)[0].split('.')[0]
    const position = row.querySelector('td[data-stat="pos"]').textContent

    starters.push({
      name: player_name,
      url: player_url,
      pfr_id,
      position
    })
  }

  return starters
}

const get_roster = ({ doc, is_home, starters }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const roster = []

  const snap_rows = Array.from(
    doc.querySelectorAll(
      '#' + (is_home ? 'home' : 'vis') + '_snap_counts tbody tr'
    )
  )

  for (const row of snap_rows) {
    const player_link = row.querySelector('th[data-stat="player"] a')
    const player_name = player_link.textContent
    const player_url = player_link.href
    const pfr_id = player_url.split('/').slice(-1)[0].split('.')[0]
    const position = row.querySelector('td[data-stat="pos"]').textContent
    const off_snap_count = Number(
      row.querySelector('td[data-stat="offense"]').textContent
    )
    const off_snap_pct = Number(
      row.querySelector('td[data-stat="off_pct"]').textContent.replace('%', '')
    )
    const def_snap_count = Number(
      row.querySelector('td[data-stat="defense"]').textContent
    )
    const def_snap_pct = Number(
      row.querySelector('td[data-stat="def_pct"]').textContent.replace('%', '')
    )
    const st_snap_count = Number(
      row.querySelector('td[data-stat="special_teams"]').textContent
    )
    const st_snap_pct = Number(
      row.querySelector('td[data-stat="st_pct"]').textContent.replace('%', '')
    )

    const starter = starters.find((starter) => starter.pfr_id === pfr_id)

    roster.push({
      name: player_name,
      url: `${config.pro_football_reference_url}${player_url}`,
      pfr_id,
      position,
      off_snap_count,
      off_snap_pct,
      def_snap_count,
      def_snap_pct,
      st_snap_count,
      st_snap_pct,
      is_starter: !!starter
    })
  }

  return roster
}

const get_teams = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const home_team_link = doc.querySelector(
    '.scorebox div:nth-child(1) strong a'
  )
  const home_team_name = home_team_link.textContent
  const home_team_url = `${config.pro_football_reference_url}${home_team_link.href}`
  const home_team_pfr_id = home_team_url.split('/').slice(-2)[0]

  const away_team_link = doc.querySelector(
    '.scorebox div:nth-child(2) strong a'
  )
  const away_team_name = away_team_link.textContent
  const away_team_url = `${config.pro_football_reference_url}${away_team_link.href}`
  const away_team_pfr_id = away_team_url.split('/').slice(-2)[0]

  return {
    home_team_abbr: fixTeam(home_team_name),
    home_team_name,
    home_team_url,
    home_team_pfr_id,

    away_team_abbr: fixTeam(away_team_name),
    away_team_name,
    away_team_url,
    away_team_pfr_id
  }
}

const get_coach = ({ doc, is_home }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const coach = {}

  const coach_element = doc.querySelector(
    `.scorebox div:nth-child(${is_home ? 1 : 2}) .datapoint a`
  )
  if (coach_element) {
    const coach_name = coach_element.textContent
    const coach_url = coach_element.href
    const pfr_id = coach_url.split('/').slice(-1)[0].split('.')[0]

    coach.name = coach_name
    coach.url = `${config.pro_football_reference_url}${coach_url}`
    coach.pfr_id = pfr_id
  }

  return coach
}

const get_scores = ({ doc }) => {
  const linescore_tbody_elem = doc.querySelector('.linescore tbody')
  const home_tr_elems = linescore_tbody_elem.querySelectorAll('tr')[0]
  const away_tr_elems = linescore_tbody_elem.querySelectorAll('tr')[1]
  const has_overtime = home_tr_elems.querySelectorAll('td').length > 7

  return {
    home_q1_score: Number(home_tr_elems.querySelectorAll('td')[2].textContent),
    home_q2_score: Number(home_tr_elems.querySelectorAll('td')[3].textContent),
    home_q3_score: Number(home_tr_elems.querySelectorAll('td')[4].textContent),
    home_q4_score: Number(home_tr_elems.querySelectorAll('td')[5].textContent),
    home_ot_score: has_overtime
      ? Number(home_tr_elems.querySelectorAll('td')[6].textContent)
      : null,
    home_final_score: has_overtime
      ? Number(home_tr_elems.querySelectorAll('td')[7].textContent)
      : Number(home_tr_elems.querySelectorAll('td')[6].textContent),

    away_q1_score: Number(away_tr_elems.querySelectorAll('td')[2].textContent),
    away_q2_score: Number(away_tr_elems.querySelectorAll('td')[3].textContent),
    away_q3_score: Number(away_tr_elems.querySelectorAll('td')[4].textContent),
    away_q4_score: Number(away_tr_elems.querySelectorAll('td')[5].textContent),
    away_ot_score: has_overtime
      ? Number(away_tr_elems.querySelectorAll('td')[6].textContent)
      : null,
    away_final_score: has_overtime
      ? Number(away_tr_elems.querySelectorAll('td')[7].textContent)
      : Number(away_tr_elems.querySelectorAll('td')[6].textContent),

    ot: has_overtime
  }
}

const get_scorebox_meta = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const scorebox_elem = doc.querySelector('.scorebox_meta')
  const scorebox_divs = Array.from(scorebox_elem.querySelectorAll('div'))
  const game_date = scorebox_elem.querySelector('div:nth-child(1)').textContent

  const game_time_elem = scorebox_divs.find((div) =>
    div.textContent.includes('Start Time')
  )
  let game_time = null
  if (game_time_elem) {
    game_time = game_time_elem.textContent.replace('Start Time: ', '').trim()
  }

  const stadium_elem = scorebox_divs.find((div) =>
    div.textContent.includes('Stadium')
  )
  const stadium = {
    name: null,
    url: null,
    stadium_pfr_id: null
  }
  if (stadium_elem) {
    const stadium_link = stadium_elem.querySelector('a')
    stadium.name = stadium_link.textContent
    stadium.url = `${config.pro_football_reference_url}${stadium_link.href}`
    stadium.stadium_pfr_id = stadium_link.href
      .split('/')
      .slice(-1)[0]
      .split('.')[0]
  }

  const attendance_elem = scorebox_divs.find((div) =>
    div.textContent.includes('Attendance')
  )
  let attendance = null
  if (attendance_elem) {
    attendance = Number(
      attendance_elem.querySelector('a').textContent.replace(',', '')
    )
  }

  const duration_elem = scorebox_divs.find((div) =>
    div.textContent.includes('Time of Game')
  )
  let duration = null
  if (duration_elem) {
    duration = duration_elem.textContent.replace('Time of Game: ', '').trim()
  }

  return {
    game_date,
    game_time,
    stadium,
    attendance,
    duration
  }
}

const get_coin_toss = ({ tr }) => {
  if (!tr) {
    return {
      coin_toss_winner: null,
      coin_toss_result: null
    }
  }

  const coin_toss_text = tr.querySelector('td:nth-child(2)').textContent

  return {
    coin_toss_winner: fixTeam(
      coin_toss_text.match(/^(.*?)\s?(\(deferred\))?$/)[1]
    ),
    coin_toss_result: coin_toss_text.includes('(deferred)')
      ? 'deferred'
      : 'receive'
  }
}

const get_ot_coin_toss = ({ tr }) => {
  if (!tr) {
    return {
      ot_coin_toss_winner: null
    }
  }

  return {
    ot_coin_toss_winner: fixTeam(
      tr.querySelector('td:nth-child(2)').textContent
    )
  }
}

const get_spread = ({ tr }) => {
  const spread_text = tr.querySelector('td:nth-child(2)').textContent

  const regex = /^(.*)\s(-?\d+(\.\d+)?)$/
  const matches = spread_text.match(regex)

  if (!matches) {
    return {
      spread_favorite: null,
      spread: null
    }
  }

  return {
    spread_favorite: fixTeam(matches[1]),
    spread: Number(matches[2])
  }
}

const get_over_under = ({ tr }) => {
  const over_under_text = tr.querySelector('td:nth-child(2)').textContent

  const regex = /^(\d+(\.\d+)?)/
  const match = over_under_text.match(regex)

  return {
    over_under: match ? Number(match[1]) : null
  }
}

const get_game_info = ({ doc }) => {
  const game_info_rows = Array.from(
    doc.querySelectorAll('#game_info tbody tr:not(.onecell)')
  )
  const coin_toss_row = game_info_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Won Toss'
  })[0]
  const ot_coin_toss_row = game_info_rows.filter((row) => {
    return row.querySelector('th').textContent === 'OT Won Toss'
  })[0]
  const stadium_roof_row = game_info_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Roof'
  })[0]
  const stadium_surface_row = game_info_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Surface'
  })[0]
  const vegas_line_row = game_info_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Vegas Line'
  })[0]
  const over_under_row = game_info_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Over/Under'
  })[0]
  const weather_row = game_info_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Weather'
  })[0]

  return {
    ...get_coin_toss({ tr: coin_toss_row }),
    ...get_ot_coin_toss({ tr: ot_coin_toss_row }),
    ...get_spread({ tr: vegas_line_row }),
    ...get_over_under({ tr: over_under_row }),

    weather_text: weather_row
      ? weather_row.querySelector('td:nth-child(2)').textContent
      : null,

    stadium_roof: stadium_roof_row
      ? stadium_roof_row.querySelector('td:nth-child(2)').textContent
      : null,
    stadium_surface: stadium_surface_row
      ? stadium_surface_row.querySelector('td:nth-child(2)').textContent
      : null
  }
}

const get_team_stats = ({ doc }) => {
  const team_stats_rows = Array.from(
    doc.querySelectorAll('#team_stats tbody tr')
  )

  const home_pfr_id = fixTeam(
    doc.querySelector('#div_team_stats thead th[data-stat="home_stat"]')
      .textContent
  )
  const away_pfr_id = fixTeam(
    doc.querySelector('#div_team_stats thead th[data-stat="vis_stat"]')
      .textContent
  )

  const team_stats = {}
  team_stats[home_pfr_id] = {
    team: home_pfr_id
  }
  team_stats[away_pfr_id] = {
    team: away_pfr_id
  }

  const first_down_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'First Downs'
  })
  if (first_down_row) {
    const first_down_tds = first_down_row[0].querySelectorAll('td[data-stat]')
    const home_first_downs = Number(first_down_tds[0].textContent)
    const away_first_downs = Number(first_down_tds[1].textContent)

    team_stats[home_pfr_id].first_downs = home_first_downs
    team_stats[away_pfr_id].first_downs = away_first_downs
  }

  const rushing_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Rush-Yds-TDs'
  })
  if (rushing_row) {
    const rushing_regex = /^(\d+)-(\d+)-(\d+)$/

    const get_team_rushing_stats = (input) => {
      const matches = input.match(rushing_regex)
      return {
        rush_att: Number(matches[1]),
        rush_yds: Number(matches[2]),
        rush_tds: Number(matches[3])
      }
    }

    const rushing_tds = rushing_row[0].querySelectorAll('td[data-stat]')
    const home_rushing_stats = get_team_rushing_stats(
      rushing_tds[0].textContent
    )
    const away_rushing_stats = get_team_rushing_stats(
      rushing_tds[1].textContent
    )

    team_stats[home_pfr_id] = {
      ...team_stats[home_pfr_id],
      ...home_rushing_stats
    }
    team_stats[away_pfr_id] = {
      ...team_stats[away_pfr_id],
      ...away_rushing_stats
    }
  }

  const passing_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Cmp-Att-Yd-TD-INT'
  })
  if (passing_row) {
    const passing_regex = /^(\d+)-(\d+)-(\d+)-(\d+)-(\d+)$/

    const get_team_passing_stats = (input) => {
      const matches = input.match(passing_regex)
      return {
        pass_cmp: Number(matches[1]),
        pass_att: Number(matches[2]),
        pass_yds: Number(matches[3]),
        pass_tds: Number(matches[4]),
        pass_int: Number(matches[5])
      }
    }

    const passing_tds = passing_row[0].querySelectorAll('td[data-stat]')
    const home_passing_stats = get_team_passing_stats(
      passing_tds[0].textContent
    )
    const away_passing_stats = get_team_passing_stats(
      passing_tds[1].textContent
    )

    team_stats[home_pfr_id] = {
      ...team_stats[home_pfr_id],
      ...home_passing_stats
    }
    team_stats[away_pfr_id] = {
      ...team_stats[away_pfr_id],
      ...away_passing_stats
    }
  }

  const sacks_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Sacked-Yards'
  })
  if (sacks_row) {
    const sacks_regex = /^(\d+)-(\d+)$/

    const get_team_sacks_stats = (input) => {
      const matches = input.match(sacks_regex)
      return {
        sacks: Number(matches[1]),
        sack_yds: Number(matches[2])
      }
    }

    const sacks_tds = sacks_row[0].querySelectorAll('td[data-stat]')
    const home_sacks_stats = get_team_sacks_stats(sacks_tds[0].textContent)
    const away_sacks_stats = get_team_sacks_stats(sacks_tds[1].textContent)

    team_stats[home_pfr_id] = {
      ...team_stats[home_pfr_id],
      ...home_sacks_stats
    }
    team_stats[away_pfr_id] = {
      ...team_stats[away_pfr_id],
      ...away_sacks_stats
    }
  }

  const net_pass_yards_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Net Pass Yards'
  })
  if (net_pass_yards_row) {
    const net_pass_yards_tds =
      net_pass_yards_row[0].querySelectorAll('td[data-stat]')
    const home_net_pass_yards = Number(net_pass_yards_tds[0].textContent)
    const away_net_pass_yards = Number(net_pass_yards_tds[1].textContent)

    team_stats[home_pfr_id].net_pass_yds = home_net_pass_yards
    team_stats[away_pfr_id].net_pass_yds = away_net_pass_yards
  }

  const total_yards_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Total Yards'
  })
  if (total_yards_row) {
    const total_yards_tds = total_yards_row[0].querySelectorAll('td[data-stat]')
    const home_total_yards = Number(total_yards_tds[0].textContent)
    const away_total_yards = Number(total_yards_tds[1].textContent)

    team_stats[home_pfr_id].total_yds = home_total_yards
    team_stats[away_pfr_id].total_yds = away_total_yards
  }

  const fumbles_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Fumbles-Lost'
  })
  if (fumbles_row) {
    const fumbles_regex = /^(\d+)-(\d+)$/

    const get_team_fumbles_stats = (input) => {
      const matches = input.match(fumbles_regex)
      return {
        fumbles: Number(matches[1]),
        fumbles_lost: Number(matches[2])
      }
    }

    const fumbles_tds = fumbles_row[0].querySelectorAll('td[data-stat]')
    const home_fumbles_stats = get_team_fumbles_stats(
      fumbles_tds[0].textContent
    )
    const away_fumbles_stats = get_team_fumbles_stats(
      fumbles_tds[1].textContent
    )

    team_stats[home_pfr_id] = {
      ...team_stats[home_pfr_id],
      ...home_fumbles_stats
    }
    team_stats[away_pfr_id] = {
      ...team_stats[away_pfr_id],
      ...away_fumbles_stats
    }
  }

  const turnovers_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Turnovers'
  })
  if (turnovers_row) {
    const turnovers_tds = turnovers_row[0].querySelectorAll('td[data-stat]')
    const home_turnovers = Number(turnovers_tds[0].textContent)
    const away_turnovers = Number(turnovers_tds[1].textContent)

    team_stats[home_pfr_id].turnovers = home_turnovers
    team_stats[away_pfr_id].turnovers = away_turnovers
  }

  const penalties_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Penalties-Yards'
  })
  if (penalties_row) {
    const penalties_regex = /^(\d+)-(\d+)$/

    const get_team_penalties_stats = (input) => {
      const matches = input.match(penalties_regex)
      return {
        penalties: Number(matches[1]),
        penalty_yds: Number(matches[2])
      }
    }

    const penalties_tds = penalties_row[0].querySelectorAll('td[data-stat]')
    const home_penalties_stats = get_team_penalties_stats(
      penalties_tds[0].textContent
    )
    const away_penalties_stats = get_team_penalties_stats(
      penalties_tds[1].textContent
    )

    team_stats[home_pfr_id] = {
      ...team_stats[home_pfr_id],
      ...home_penalties_stats
    }
    team_stats[away_pfr_id] = {
      ...team_stats[away_pfr_id],
      ...away_penalties_stats
    }
  }

  const third_down_conv_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Third Down Conv.'
  })
  if (third_down_conv_row) {
    const third_down_regex = /^(\d+)-(\d+)$/

    const get_team_third_down_stats = (input) => {
      const matches = input.match(third_down_regex)
      return {
        third_down_att: Number(matches[1]),
        third_down_conv: Number(matches[2])
      }
    }

    const third_down_tds =
      third_down_conv_row[0].querySelectorAll('td[data-stat]')
    const home_third_down_stats = get_team_third_down_stats(
      third_down_tds[0].textContent
    )
    const away_third_down_stats = get_team_third_down_stats(
      third_down_tds[1].textContent
    )

    team_stats[home_pfr_id] = {
      ...team_stats[home_pfr_id],
      ...home_third_down_stats
    }
    team_stats[away_pfr_id] = {
      ...team_stats[away_pfr_id],
      ...away_third_down_stats
    }
  }

  const fourth_down_conv_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Fourth Down Conv.'
  })
  if (fourth_down_conv_row) {
    const fourth_down_regex = /^(\d+)-(\d+)$/

    const get_team_fourth_down_stats = (input) => {
      const matches = input.match(fourth_down_regex)
      return {
        fourth_down_att: Number(matches[1]),
        fourth_down_conv: Number(matches[2])
      }
    }

    const fourth_down_tds =
      fourth_down_conv_row[0].querySelectorAll('td[data-stat]')
    const home_fourth_down_stats = get_team_fourth_down_stats(
      fourth_down_tds[0].textContent
    )
    const away_fourth_down_stats = get_team_fourth_down_stats(
      fourth_down_tds[1].textContent
    )

    team_stats[home_pfr_id] = {
      ...team_stats[home_pfr_id],
      ...home_fourth_down_stats
    }
    team_stats[away_pfr_id] = {
      ...team_stats[away_pfr_id],
      ...away_fourth_down_stats
    }
  }

  const time_of_possession_row = team_stats_rows.filter((row) => {
    return row.querySelector('th').textContent === 'Time of Possession'
  })
  if (time_of_possession_row) {
    const time_of_possession_regex = /^(\d+):(\d+)$/

    const get_team_time_of_possession_stats = (input) => {
      const matches = input.match(time_of_possession_regex)
      return {
        time_of_possession: Number(matches[1]) * 60 + Number(matches[2])
      }
    }

    const time_of_possession_tds =
      time_of_possession_row[0].querySelectorAll('td[data-stat]')
    const home_time_of_possession_stats = get_team_time_of_possession_stats(
      time_of_possession_tds[0].textContent
    )
    const away_time_of_possession_stats = get_team_time_of_possession_stats(
      time_of_possession_tds[1].textContent
    )

    team_stats[home_pfr_id] = {
      ...team_stats[home_pfr_id],
      ...home_time_of_possession_stats
    }
    team_stats[away_pfr_id] = {
      ...team_stats[away_pfr_id],
      ...away_time_of_possession_stats
    }
  }

  return Object.values(team_stats)
}

const get_expected_points_summary = ({ doc }) => {
  const expected_points_summary_rows = Array.from(
    doc.querySelectorAll('#expected_points tbody tr')
  )

  return expected_points_summary_rows.map((row) => {
    const team = fixTeam(row.querySelector('th').textContent)
    const tds = row.querySelectorAll('td[data-stat]')
    const stats = {}
    for (const td of tds) {
      const stat = td.getAttribute('data-stat')
      const value = Number(td.textContent)
      stats[stat] = value
    }

    return {
      team,
      ...stats
    }
  })
}

// const get_team_stats = ({ doc }) => {
//   // TODO
// }

const get_player_passing_rushing_receiving = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const rows = Array.from(
    doc.querySelectorAll('#player_offense tbody tr:not([class])')
  )

  return rows.map((row) => {
    const player_link = row.querySelector('th a')
    const player_name = player_link.textContent
    const player_url = `${config.pro_football_reference_url}${player_link.href}`
    const pfr_id = player_url.match(/\/players\/[A-Z]+\/([^/.]+)/)[1]

    const tds = row.querySelectorAll('td[data-stat]')
    const stats = {}
    for (const td of tds) {
      const stat = td.getAttribute('data-stat')
      if (stat === 'team') {
        stats.team = fixTeam(td.textContent)
        continue
      }
      const value = Number(td.textContent)
      stats[stat] = value
    }

    return {
      player_name,
      player_url,
      pfr_id,
      ...stats
    }
  })
}

const get_player_defense = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const rows = Array.from(
    doc.querySelectorAll('#player_defense tbody tr:not([class])')
  )

  return rows.map((row) => {
    const player_link = row.querySelector('th a')
    const player_name = player_link.textContent
    const player_url = `${config.pro_football_reference_url}${player_link.href}`
    const pfr_id = player_url.match(/\/players\/[A-Z]+\/([^/.]+)/)[1]

    const tds = row.querySelectorAll('td[data-stat]')
    const stats = {}
    for (const td of tds) {
      const stat = td.getAttribute('data-stat')
      if (stat === 'team') {
        stats.team = fixTeam(td.textContent)
        continue
      }
      const value = Number(td.textContent)
      stats[stat] = value
    }

    return {
      player_name,
      player_url,
      pfr_id,
      ...stats
    }
  })
}

const get_player_kick_punt_returns = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const rows = Array.from(
    doc.querySelectorAll('#returns tbody tr:not([class])')
  )

  return rows.map((row) => {
    const player_link = row.querySelector('th a')
    const player_name = player_link.textContent
    const player_url = `${config.pro_football_reference_url}${player_link.href}`
    const pfr_id = player_url.match(/\/players\/[A-Z]+\/([^/.]+)/)[1]

    const tds = row.querySelectorAll('td[data-stat]')
    const stats = {}
    for (const td of tds) {
      const stat = td.getAttribute('data-stat')
      if (stat === 'team') {
        stats.team = fixTeam(td.textContent)
        continue
      }
      const value = Number(td.textContent)
      stats[stat] = value
    }

    return {
      player_name,
      player_url,
      pfr_id,
      ...stats
    }
  })
}

const get_player_kicking_punting = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const rows = Array.from(
    doc.querySelectorAll('#kicking tbody tr:not([class])')
  )

  return rows.map((row) => {
    const player_link = row.querySelector('th a')
    const player_name = player_link.textContent
    const player_url = `${config.pro_football_reference_url}${player_link.href}`
    const pfr_id = player_url.match(/\/players\/[A-Z]+\/([^/.]+)/)[1]

    const tds = row.querySelectorAll('td[data-stat]')
    const stats = {}
    for (const td of tds) {
      const stat = td.getAttribute('data-stat')
      if (stat === 'team') {
        stats.team = fixTeam(td.textContent)
        continue
      }
      const value = Number(td.textContent)
      stats[stat] = value
    }

    return {
      player_name,
      player_url,
      pfr_id,
      ...stats
    }
  })
}

const get_player_advanced_passing = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const rows = Array.from(
    doc.querySelectorAll('#passing_advanced tbody tr:not([class])')
  )

  return rows.map((row) => {
    const player_link = row.querySelector('th a')
    const player_name = player_link.textContent
    const player_url = `${config.pro_football_reference_url}${player_link.href}`
    const pfr_id = player_url.match(/\/players\/[A-Z]+\/([^/.]+)/)[1]

    const tds = row.querySelectorAll('td[data-stat]')
    const stats = {}
    for (const td of tds) {
      const stat = td.getAttribute('data-stat')
      if (stat === 'team') {
        stats.team = fixTeam(td.textContent)
        continue
      }
      const value = Number(td.textContent.replace('%', ''))
      stats[stat] = value
    }

    return {
      player_name,
      player_url,
      pfr_id,
      ...stats
    }
  })
}

const get_player_advanced_rushing = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const rows = Array.from(
    doc.querySelectorAll('#rushing_advanced tbody tr:not([class])')
  )

  return rows.map((row) => {
    const player_link = row.querySelector('th a')
    const player_name = player_link.textContent
    const player_url = `${config.pro_football_reference_url}${player_link.href}`
    const pfr_id = player_url.match(/\/players\/[A-Z]+\/([^/.]+)/)[1]

    const tds = row.querySelectorAll('td[data-stat]')
    const stats = {}
    for (const td of tds) {
      const stat = td.getAttribute('data-stat')
      if (stat === 'team') {
        stats.team = fixTeam(td.textContent)
        continue
      }
      const value = Number(td.textContent.replace('%', ''))
      stats[stat] = value
    }

    return {
      player_name,
      player_url,
      pfr_id,
      ...stats
    }
  })
}

const get_player_advanced_receiving = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const rows = Array.from(
    doc.querySelectorAll('#receiving_advanced tbody tr:not([class])')
  )

  return rows.map((row) => {
    const player_link = row.querySelector('th a')
    const player_name = player_link.textContent
    const player_url = `${config.pro_football_reference_url}${player_link.href}`
    const pfr_id = player_url.match(/\/players\/[A-Z]+\/([^/.]+)/)[1]

    const tds = row.querySelectorAll('td[data-stat]')
    const stats = {}
    for (const td of tds) {
      const stat = td.getAttribute('data-stat')
      if (stat === 'team') {
        stats.team = fixTeam(td.textContent)
        continue
      }
      const value = Number(td.textContent.replace('%', ''))
      stats[stat] = value
    }

    return {
      player_name,
      player_url,
      pfr_id,
      ...stats
    }
  })
}

const get_player_advanced_defense = ({ doc }) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const rows = Array.from(
    doc.querySelectorAll('#defense_advanced tbody tr:not([class])')
  )

  return rows.map((row) => {
    const player_link = row.querySelector('th a')
    const player_name = player_link.textContent
    const player_url = `${config.pro_football_reference_url}${player_link.href}`
    const pfr_id = player_url.match(/\/players\/[A-Z]+\/([^/.]+)/)[1]

    const tds = row.querySelectorAll('td[data-stat]')
    const stats = {}
    for (const td of tds) {
      const stat = td.getAttribute('data-stat')
      if (stat === 'team') {
        stats.team = fixTeam(td.textContent)
        continue
      }
      const value = Number(td.textContent.replace('%', ''))
      stats[stat] = value
    }

    return {
      player_name,
      player_url,
      pfr_id,
      ...stats
    }
  })
}

const get_plays = ({ doc }) => {
  const rows = Array.from(
    doc.querySelectorAll('#div_pbp tbody tr:not([class])')
  )

  return rows.map((row) => {
    const cols = row.querySelectorAll('[data-stat]')
    const stats = {}
    for (const col of cols) {
      const stat = col.getAttribute('data-stat')
      if (stat === 'detail') {
        stats.detail_text = col.textContent
        stats.detail_html = col.innerHTML
        continue
      }

      const value = col.textContent
      stats[stat] = value
    }

    return stats
  })
}

const get_drives = ({ doc, is_home }) => {
  const rows = Array.from(
    doc.querySelectorAll(`#${is_home ? 'home' : 'vis'}_drives tbody tr`)
  )

  return rows.map((row) => {
    const cols = row.querySelectorAll('[data-stat]')
    const stats = {}
    for (const col of cols) {
      const stat = col.getAttribute('data-stat')
      const value = col.textContent
      stats[stat] = value
    }

    return stats
  })
}

const format_player_gamelogs = ({ pfr_game }) => {
  const player_gamelogs = {}

  const set_player_gamelog_values = ({ pfr_id, ...values }) => {
    if (!player_gamelogs[pfr_id]) {
      player_gamelogs[pfr_id] = {
        pfr_game_id: pfr_game.pfr_game_id,
        week: pfr_game.week,
        seas_type: pfr_game.seas_type,
        pfr_id,
        ...values
      }
    } else {
      player_gamelogs[pfr_id] = {
        ...player_gamelogs[pfr_id],
        ...values
      }
    }
  }

  const handle_roster_player = ({ roster_player, tm, opp }) => {
    const { pfr_id } = roster_player
    set_player_gamelog_values({
      pfr_id,

      tm,
      opp,
      pos: roster_player.position,

      active: true,
      starter: roster_player.is_starter,

      snp:
        roster_player.off_snap_count +
        roster_player.def_snap_count +
        roster_player.st_snap_count,

      snaps_off: roster_player.off_snap_count,
      snaps_def: roster_player.def_snap_count,
      snaps_st: roster_player.st_snap_count
    })
  }

  for (const roster_player of pfr_game.home_roster) {
    handle_roster_player({
      roster_player,
      tm: fixTeam(pfr_game.home_team_abbr),
      opp: fixTeam(pfr_game.away_team_abbr)
    })
  }

  for (const roster_player of pfr_game.away_roster) {
    handle_roster_player({
      roster_player,
      tm: fixTeam(pfr_game.away_team_abbr),
      opp: fixTeam(pfr_game.home_team_abbr)
    })
  }

  for (const offense_stats of pfr_game.player_passing_rushing_receiving) {
    const { pfr_id, team } = offense_stats
    set_player_gamelog_values({
      pfr_id,

      tm: fixTeam(team),
      opp:
        team === pfr_game.home_team_abbr
          ? fixTeam(pfr_game.away_team_abbr)
          : fixTeam(pfr_game.home_team_abbr),

      pa: offense_stats.pass_att,
      pc: offense_stats.pass_cmp,
      py: offense_stats.pass_yds,
      ints: offense_stats.pass_int,
      tdp: offense_stats.pass_td,

      ra: offense_stats.rush_att,
      ry: offense_stats.rush_yds,
      tdr: offense_stats.rush_td,
      fuml: offense_stats.fumbles_lost,

      trg: offense_stats.targets,
      rec: offense_stats.rec,
      recy: offense_stats.rec_yds,
      tdrec: offense_stats.rec_td
    })
  }

  for (const kick_punt_return_stats of pfr_game.kick_punt_returns) {
    const { pfr_id, team } = kick_punt_return_stats
    set_player_gamelog_values({
      pfr_id,

      tm: fixTeam(team),
      opp:
        team === pfr_game.home_team_abbr
          ? fixTeam(pfr_game.away_team_abbr)
          : fixTeam(pfr_game.home_team_abbr),

      prtd: kick_punt_return_stats.punt_ret_td,
      krtd: kick_punt_return_stats.kick_ret_td
    })
  }

  // generate team defense and special teams gamelog
  const team_defense_gamelogs = {}
  team_defense_gamelogs[pfr_game.home_team_abbr] = {
    pfr_id: pfr_game.home_team_abbr,
    tm: fixTeam(pfr_game.home_team_abbr),
    opp: fixTeam(pfr_game.away_team_abbr)
  }
  team_defense_gamelogs[pfr_game.away_team_abbr] = {
    pfr_id: pfr_game.away_team_abbr,
    tm: fixTeam(pfr_game.away_team_abbr),
    opp: fixTeam(pfr_game.home_team_abbr)
  }

  constants.dstStats.forEach((stat) => {
    team_defense_gamelogs[pfr_game.home_team_abbr][stat] = 0
    team_defense_gamelogs[pfr_game.away_team_abbr][stat] = 0
  })

  // get team defense stat keys from first player
  const defense_stats_keys = Object.keys(pfr_game.player_defense[0]).filter(
    (key) => !isNaN(pfr_game.player_defense[0][key])
  )

  // sum up defense stats for each team
  for (const defense_stats of pfr_game.player_defense) {
    const { team } = defense_stats
    for (const stat of defense_stats_keys) {
      if (!team_defense_gamelogs[team][stat]) {
        team_defense_gamelogs[team][stat] = 0
      }
      team_defense_gamelogs[team][stat] += defense_stats[stat]
    }
  }

  // sum up kick punt returns for each team
  const kick_punt_return_stats_keys = Object.keys(
    pfr_game.kick_punt_returns[0]
  ).filter((key) => !isNaN(pfr_game.kick_punt_returns[0][key]))

  for (const kick_punt_return_stats of pfr_game.kick_punt_returns) {
    const { team } = kick_punt_return_stats
    for (const stat of kick_punt_return_stats_keys) {
      if (!team_defense_gamelogs[team][stat]) {
        team_defense_gamelogs[team][stat] = 0
      }
      team_defense_gamelogs[team][stat] += kick_punt_return_stats[stat]
    }
  }

  // format team defense gamelogs and add to player_gamelogs
  for (const team_defense_gamelog of Object.values(team_defense_gamelogs)) {
    set_player_gamelog_values({
      pfr_id: team_defense_gamelog.pfr_id,

      dsk: team_defense_gamelog.sacks,
      dint: team_defense_gamelog.def_int,
      dff: team_defense_gamelog.fumbles_forced,
      drf: team_defense_gamelog.fumbles_rec,
      dtno: null, // TODO
      dfds: null, // TODO
      dpa: null, // TODO
      dya: null, // TODO
      dblk: null, // TODO
      dsf: null, // TODO
      dtpr: null, // TODO
      dtd:
        team_defense_gamelog.def_int_td + team_defense_gamelog.fumbles_rec_td,

      krtd: team_defense_gamelog.kick_ret_td,
      prtd: team_defense_gamelog.punt_ret_td
    })
  }

  return Object.values(player_gamelogs)
}

const format_game_html = (html) => {
  const regex = /<div class="placeholder"><\/div>[^<]{0,10}<!--([\s\S]*?)-->/g

  let match
  while ((match = regex.exec(html)) !== null) {
    const [full_match, comment] = match

    // update html and unescape comment
    html = html.replace(full_match, comment)
  }

  return html
}

export const get_players = async ({ ignore_cache = false } = {}) => {
  const cache_key = '/pro-football-reference/players.json'
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }
  }

  const links = await get_players_page_links({ ignore_cache })

  const players = []
  for (const url of links) {
    const players_from_page = await get_players_from_page({ url, ignore_cache })
    players.push(...players_from_page)
  }

  if (players.length) {
    await cache.set({ key: cache_key, value: players })
  }

  return players
}

export const get_games = async ({
  year = constants.season.year,
  ignore_cache = false
} = {}) => {
  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const cache_key = `/pro-football-reference/games/${year}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }
  }

  const url = `${config.pro_football_reference_url}/years/${year}/games.htm`
  log(`fetching ${url}`)

  const response = await fetch(url)
  const text = await response.text()
  const dom = new JSDOM(text)
  const doc = dom.window.document
  const table_rows = doc.querySelectorAll('#games tbody tr:not([class])')
  const game_rows = Array.from(table_rows).filter((row) => {
    const week_text = row.querySelector('th[data-stat="week_num"]').textContent
    return week_text
  })
  const games = game_rows.map((row) => {
    const week_text = row.querySelector('th[data-stat="week_num"]').textContent
    const week_num = Number(week_text)
    const is_post_season = isNaN(week_num)

    const seas_type = is_post_season ? 'POST' : 'REG'
    const week_type = is_post_season
      ? get_post_season_week_type(week_text)
      : 'REG'
    const date = row
      .querySelector('td[data-stat="game_date"]')
      .textContent.replace('-', '/')
    const time_est = format_time(
      row.querySelector('td[data-stat="gametime"]').textContent
    )
    const day = getGameDayAbbreviation({ date, time_est, week_type, seas_type })
    const week = is_post_season ? get_post_season_week_from_day(day) : week_num
    const game_link = `${config.pro_football_reference_url}${
      row.querySelector('td[data-stat="boxscore_word"] a').href
    }`
    const pfr_game_id = game_link.split('/').slice(-1)[0].split('.')[0]

    return {
      week,
      day,
      date,
      time_est,
      game_link,
      pfr_game_id,
      seas_type
    }
  })

  if (games.length) {
    await cache.set({ key: cache_key, value: games })
  }

  return games
}

export const get_game = async ({
  pfr_game_id,
  pfr_game_meta,
  ignore_cache = false
} = {}) => {
  if (!pfr_game_id) {
    throw new Error('pfr_game_id is required')
  }

  if (!config.pro_football_reference_url) {
    throw new Error('config.pro_football_reference_url is required')
  }

  const cache_key = `/pro-football-reference/games/${pfr_game_id}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return {
        cached: true,
        ...cache_value
      }
    }
  }

  const url = `${config.pro_football_reference_url}/boxscores/${pfr_game_id}.htm`
  log(`fetching ${url}`)
  const response = await fetch(url)
  const text = await response.text()
  const formatted_text = format_game_html(text)
  const dom = new JSDOM(formatted_text)
  const doc = dom.window.document

  const home_starters = get_starters({
    doc,
    is_home: true
  })
  const away_starters = get_starters({
    doc,
    is_home: false
  })

  const home_roster = get_roster({
    doc,
    is_home: true,
    starters: home_starters
  })
  const away_roster = get_roster({
    doc,
    is_home: false,
    starters: away_starters
  })

  const officials = Array.from(
    doc.querySelectorAll('#officials tbody tr:not(.onecell)')
  ).map((row) => {
    const role = row.querySelector('th').textContent
    const referee_link = row.querySelector('td a')

    return {
      role,
      name: referee_link ? referee_link.textContent : null,
      link: referee_link
        ? `${config.pro_football_reference_url}${referee_link.href}`
        : null,
      referee_pfr_id: referee_link
        ? referee_link.href.split('/').slice(-1)[0].split('.')[0]
        : null
    }
  })

  const week_games_link = doc.querySelector('#div_other_scores h2 a')
  const week_games_text = week_games_link.textContent
  const is_playoffs = week_games_text.includes('Playoffs')
  const seas_type = is_playoffs ? 'POST' : 'REG'
  const year = Number(week_games_link.href.split('/')[2])

  const regex = /\/years\/\d+\/week_(\d+)\.htm/
  const match = week_games_link.href.match(regex)
  const week_num = match ? Number(match[1]) : null
  let week = null

  if (week_num) {
    if (!is_playoffs) {
      week = week_num
    } else {
      const weeks_query = await db('nfl_games')
        .select('week')
        .where({ year, seas_type: 'REG' })
        .groupBy('week')
      const regular_season_weeks = weeks_query.length

      week = week_num - regular_season_weeks
    }
  }

  const game = {
    ...pfr_game_meta,

    week,
    year,
    seas_type,

    // TODO add day
    // TODO add week_type

    pfr_game_id,

    home_coach: get_coach({ doc, is_home: true }),
    away_coach: get_coach({ doc, is_home: false }),

    ...get_teams({ doc }),
    ...get_scores({ doc }),
    ...get_scorebox_meta({ doc }),
    ...get_game_info({ doc }),

    team_stats: get_team_stats({ doc }),

    officials,

    expected_points_summary: get_expected_points_summary({ doc }),
    // team_stats: get_team_stats({ doc }),
    player_passing_rushing_receiving: get_player_passing_rushing_receiving({
      doc
    }),
    player_defense: get_player_defense({ doc }),

    kick_punt_returns: get_player_kick_punt_returns({ doc }),
    kicking_punting: get_player_kicking_punting({ doc }),

    advanced_passing: get_player_advanced_passing({ doc }),
    advanced_rushing: get_player_advanced_rushing({ doc }),
    advanced_receiving: get_player_advanced_receiving({ doc }),
    advanced_defense: get_player_advanced_defense({ doc }),

    home_roster,
    away_roster,
    plays: get_plays({ doc }),
    home_drives: get_drives({ doc, is_home: true }),
    away_drives: get_drives({ doc, is_home: false })
  }

  if (game.pfr_game_id && game.over_under) {
    await cache.set({ key: cache_key, value: game })
  }

  return game
}

export const get_player_gamelogs_for_season = async ({
  year = constants.season.year,
  ignore_cache = false
} = {}) => {
  const cache_key = `/pro-football-reference/player-gamelogs/${year}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      return cache_value
    }
  }

  let player_gamelogs = []

  const games = await get_games({ year, ignore_cache })
  log(`fetching ${games.length} games for ${year}`)

  for (const game of games) {
    const pfr_game = await get_game({
      pfr_game_id: game.pfr_game_id,
      pfr_game_meta: game,
      ignore_cache
    })

    const game_player_gamelogs = format_player_gamelogs({ pfr_game })
    player_gamelogs = player_gamelogs.concat(game_player_gamelogs)

    // delay next request if previous request was not cached
    if (!pfr_game.cached) {
      await wait(8000)
    }
  }

  player_gamelogs = player_gamelogs.sort(
    (a, b) => a.seas_type - b.seas_type || a.week - b.week
  )

  if (player_gamelogs.length) {
    await cache.set({ key: cache_key, value: player_gamelogs })
  }

  return player_gamelogs
}
