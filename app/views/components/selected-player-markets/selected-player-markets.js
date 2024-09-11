import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsBrokenAxis from 'highcharts/modules/broken-axis'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import FormControl from '@mui/material/FormControl'

import PercentileMetric from '@components/percentile-metric'
import { calculatePercentiles } from '@libs-shared'

import './selected-player-markets.styl'

HighchartsBrokenAxis(Highcharts)

function MarketCard({ market_name, markets }) {
  const is_alt_line = market_name.includes('ALT')
  const [selected_line, set_selected_line] = useState('')
  const has_line = useMemo(() => check_has_line(markets), [markets])

  const lines = useMemo(() => {
    if (!is_alt_line) return null
    if (!markets || markets.length === 0) return null
    return [
      ...new Set(
        markets.flatMap((market) =>
          market.selections.map((selection) => selection.selection_metric_line)
        )
      )
    ].sort((a, b) => a - b)
  }, [is_alt_line, markets])

  useEffect(() => {
    if (is_alt_line && lines && lines.length > 0) {
      set_selected_line(lines[0])
    }
  }, [is_alt_line, lines])

  const filtered_markets = useMemo(() => {
    if (!markets || markets.length === 0) return []
    if (!is_alt_line) return markets
    return markets
      .map((market) => ({
        ...market,
        selections: market.selections.filter(
          (selection) => selection.selection_metric_line === selected_line
        )
      }))
      .filter((market) => market.selections.length > 0)
  }, [is_alt_line, markets, selected_line])

  const chart_options = useMemo(
    () =>
      create_chart_options({
        markets: filtered_markets,
        has_line,
        is_alt_line
      }),
    [filtered_markets, is_alt_line, has_line]
  )

  const { table_data, percentiles } = useMemo(
    () =>
      create_table_data({ markets: filtered_markets, has_line, is_alt_line }),
    [filtered_markets, is_alt_line, has_line]
  )

  if (!markets || markets.length === 0) return null

  return (
    <div className='market-card'>
      {is_alt_line && (
        <FormControl style={{ minWidth: 80 }}>
          <InputLabel id='alt-line-label'>Alt Line</InputLabel>
          <Select
            label='Alt Line'
            value={selected_line}
            onChange={(e) => set_selected_line(e.target.value)}
            className='line-select'
          >
            {lines.map((line) => (
              <MenuItem key={line} value={line}>
                {line}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      <HighchartsReact highcharts={Highcharts} options={chart_options} />
      <div className='selected__table'>
        <TableHeader {...{ has_line, is_alt_line }} />
        <TableBody {...{ table_data, has_line, is_alt_line, percentiles }} />
      </div>
    </div>
  )
}

MarketCard.propTypes = {
  market_name: PropTypes.string,
  markets: PropTypes.array.isRequired
}

function check_has_line(markets = []) {
  return markets.some((market) =>
    market.selections.some(
      (selection) => selection.selection_metric_line !== null
    )
  )
}

function create_table_data({ markets, is_alt_line, has_line }) {
  const combined_data = {}
  const items_for_percentiles = []

  markets.forEach((market) => {
    market.selections.forEach((selection) => {
      const key = `${market.source_id}_${selection.timestamp}_${market.year}_${market.week}`
      if (!combined_data[key]) {
        const data_point = {
          source: market.source_id,
          timestamp: new Date(selection.timestamp * 1000).toLocaleString(),
          year: market.year,
          week: market.week,
          current_season_hit_rate_hard: selection.current_season_hit_rate_hard,
          current_season_edge_hard: selection.current_season_edge_hard,
          last_five_hit_rate_hard: selection.last_five_hit_rate_hard,
          last_five_edge_hard: selection.last_five_edge_hard,
          last_ten_hit_rate_hard: selection.last_ten_hit_rate_hard,
          last_ten_edge_hard: selection.last_ten_edge_hard,
          last_season_hit_rate_hard: selection.last_season_hit_rate_hard,
          last_season_edge_hard: selection.last_season_edge_hard,
          overall_hit_rate_hard: selection.overall_hit_rate_hard,
          overall_edge_hard: selection.overall_edge_hard
        }

        combined_data[key] = data_point
        items_for_percentiles.push(data_point)

        if (has_line && !is_alt_line) {
          combined_data[key].line = selection.selection_metric_line
          combined_data[key].over_odds = null
          combined_data[key].under_odds = null
        } else {
          combined_data[key].odds = selection.odds_american
        }
      }

      if (has_line && !is_alt_line) {
        const odds_type = selection.selection_name
          .toLowerCase()
          .includes('over')
          ? 'over_odds'
          : 'under_odds'
        combined_data[key][odds_type] = selection.odds_american
      }
    })
  })

  const percentiles = calculatePercentiles({
    items: items_for_percentiles,
    stats: [
      'current_season_hit_rate_hard',
      'current_season_edge_hard',
      'last_five_hit_rate_hard',
      'last_five_edge_hard',
      'last_ten_hit_rate_hard',
      'last_ten_edge_hard',
      'last_season_hit_rate_hard',
      'last_season_edge_hard',
      'overall_hit_rate_hard',
      'overall_edge_hard'
    ]
  })

  return {
    table_data: Object.values(combined_data).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    ),
    percentiles
  }
}

const metric_groups = [
  { name: 'This Season', prefix: 'current_season' },
  { name: 'Last Season', prefix: 'last_season' },
  { name: 'Last 5', prefix: 'last_five' },
  { name: 'Last 10', prefix: 'last_ten' },
  { name: 'Overall', prefix: 'overall' }
]

function TableHeader({ has_line, is_alt_line }) {
  const render_market_data = () =>
    has_line && !is_alt_line ? (
      <>
        <div className='table__cell'>Line</div>
        <div className='table__cell'>Over</div>
        <div className='table__cell'>Under</div>
      </>
    ) : (
      <div className='table__cell'>Odds</div>
    )

  const render_metric_groups = () =>
    metric_groups.map((group) => (
      <div key={group.name} className='row__group'>
        <div className='row__group-head'>{group.name}</div>
        <div className='row__group-body'>
          <div className='table__cell'>Hit Rate</div>
          <div className='table__cell'>Edge</div>
        </div>
      </div>
    ))

  return (
    <>
      <div className='selected__table-header sticky__column'>
        <div className='row__group-head'>Market Data</div>
      </div>
      <div className='selected__table-header sticky'>
        <div className='table__cell'>Year</div>
        <div className='table__cell'>Week</div>
        <div className='table__cell source'>Source</div>
        {render_market_data()}
        {render_metric_groups()}
        <div className='table__cell timestamp'>Timestamp</div>
      </div>
    </>
  )
}

TableHeader.propTypes = {
  has_line: PropTypes.bool.isRequired,
  is_alt_line: PropTypes.bool.isRequired
}

function TableBody({ table_data, has_line, is_alt_line, percentiles }) {
  const render_market_data = (row) =>
    has_line && !is_alt_line ? (
      <>
        <div className='table__cell'>{row.line}</div>
        <div className='table__cell'>{row.over_odds}</div>
        <div className='table__cell'>{row.under_odds}</div>
      </>
    ) : (
      <div className='table__cell'>{row.odds}</div>
    )

  const render_metric_group = (row, group) => {
    const field_items = [
      {
        field: `${group.prefix}_hit_rate_hard`,
        label: 'Hit Rate',
        fixed: 0,
        is_percentage: true
      },
      {
        field: `${group.prefix}_edge_hard`,
        label: 'Edge',
        fixed: 0,
        is_percentage: true
      }
    ]

    return (
      <div key={group.name} className='row__group'>
        <div className='row__group-body'>
          {field_items.map(({ field, label, fixed, is_percentage }) => (
            <PercentileMetric
              key={field}
              value={row[field]}
              percentile={percentiles[field]}
              fixed={fixed}
              is_percentage={is_percentage}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {table_data.map((row, index) => (
        <div key={index} className='table__row'>
          <div className='table__cell'>{row.year}</div>
          <div className='table__cell'>{row.week}</div>
          <div className='table__cell source'>{row.source}</div>
          {render_market_data(row)}
          {metric_groups.map((group) => render_metric_group(row, group))}
          <div className='table__cell timestamp'>{row.timestamp}</div>
        </div>
      ))}
    </>
  )
}

TableBody.propTypes = {
  table_data: PropTypes.array.isRequired,
  has_line: PropTypes.bool.isRequired,
  is_alt_line: PropTypes.bool.isRequired,
  percentiles: PropTypes.object.isRequired
}

function create_chart_options({ markets, has_line, is_alt_line }) {
  if (has_line && !is_alt_line) {
    const combined_data = create_combined_data(markets)
    return create_line_and_odds_chart({ combined_data, markets })
  } else {
    return create_odds_only_chart({ markets })
  }
}

function create_combined_data(markets) {
  const combined_data = []

  markets.forEach((market) => {
    market.selections.forEach((selection) => {
      const timestamp = selection.timestamp * 1000
      const type = selection.selection_name.toLowerCase().includes('over')
        ? 'over'
        : 'under'
      const line = parseFloat(selection.selection_metric_line)
      const odds = selection.odds_american

      let data_point = combined_data.find((d) => d.timestamp === timestamp)
      if (!data_point) {
        data_point = { timestamp, line, over_odds: null, under_odds: null }
        combined_data.push(data_point)
      }

      data_point[`${type}_odds`] = odds
      if (type === 'over') {
        data_point.line = line
      }
    })
  })

  return combined_data.sort((a, b) => a.timestamp - b.timestamp)
}

function create_line_and_odds_chart({ combined_data, markets }) {
  const series_data = {
    line: [],
    over_odds: [],
    under_odds: []
  }

  combined_data.forEach((data_point) => {
    series_data.line.push([data_point.timestamp, data_point.line])
    series_data.over_odds.push([data_point.timestamp, data_point.over_odds])
    series_data.under_odds.push([data_point.timestamp, data_point.under_odds])
  })

  const game_info = extract_game_info(markets)
  const { plot_lines, plot_bands, axis_breaks } =
    create_plot_annotations(game_info)

  return {
    credits: {
      enabled: false
    },
    chart: {
      type: 'line',
      spacingBottom: 50,
      spacingTop: 50
    },
    title: {
      text: ''
    },
    xAxis: create_x_axis({ game_info, plot_lines, plot_bands, axis_breaks }),
    yAxis: [
      {
        title: { text: 'Betting Line' },
        minInterval: 0.5,
        labels: {
          reserveSpace: true
        }
      },
      {
        title: { text: 'Odds (American)' },
        opposite: true,
        labels: {
          reserveSpace: true
        }
      }
    ],
    series: [
      {
        name: 'Line',
        data: series_data.line,
        yAxis: 0,
        color: '#000000',
        label: true,
        marker: {
          enabled: false,
          states: {
            hover: {
              enabled: true
            }
          }
        }
      },
      {
        name: 'Over Odds',
        data: series_data.over_odds,
        yAxis: 1,
        color: '#0000FF',
        dashStyle: 'dot',
        marker: {
          enabled: false,
          states: {
            hover: {
              enabled: true
            }
          }
        }
      },
      {
        name: 'Under Odds',
        data: series_data.under_odds,
        yAxis: 1,
        color: '#008000',
        dashStyle: 'dot',
        marker: {
          enabled: false,
          states: {
            hover: {
              enabled: true
            }
          }
        }
      }
    ]
  }
}

function create_odds_only_chart({ markets }) {
  const series_data = []

  markets.forEach((market) => {
    market.selections.forEach((selection) => {
      const timestamp = selection.timestamp * 1000
      const odds = selection.odds_american
      series_data.push([timestamp, odds])
    })
  })

  series_data.sort((a, b) => a[0] - b[0])

  const game_info = extract_game_info(markets)
  const { plot_lines, plot_bands, axis_breaks } =
    create_plot_annotations(game_info)

  return {
    credits: {
      enabled: false
    },
    chart: {
      type: 'line',
      spacingBottom: 50,
      spacingTop: 50
    },
    title: {
      text: ''
    },
    xAxis: create_x_axis({ game_info, plot_lines, plot_bands, axis_breaks }),
    yAxis: {
      title: { text: 'Odds (American)' },
      labels: {
        reserveSpace: true
      }
    },
    series: [
      {
        name: 'Odds',
        data: series_data,
        color: '#0000FF'
      }
    ]
  }
}

function extract_game_info(markets) {
  const unique_games = {}

  markets.forEach((market) => {
    const {
      event_date,
      event_time_est,
      home_team,
      away_team,
      week,
      year,
      esbid
    } = market

    if (!esbid) {
      return
    }

    const game_key = `${event_date}_${home_team}_${away_team}`
    if (!unique_games[game_key]) {
      unique_games[game_key] = {
        event_date,
        event_time_est,
        home_team,
        away_team,
        week,
        year
      }
    }
  })

  return Object.values(unique_games)
}

function create_plot_annotations(game_info) {
  const plot_lines = []
  const plot_bands = []
  const axis_breaks = []

  game_info.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  game_info.forEach((game, index) => {
    const game_time = new Date(
      `${game.event_date} ${game.event_time_est} EST`
    ).getTime()
    game.game_time = game_time // Store game_time for later use
    const week_start = new Date(game_time)
    week_start.setDate(week_start.getDate() - ((week_start.getDay() + 5) % 7)) // Tuesday of the game week
    week_start.setHours(0, 0, 0, 0)

    plot_lines.push({
      color: '#FF0000',
      width: 2,
      value: game_time
    })

    plot_bands.push({
      color: 'rgba(68, 170, 213, 0.1)',
      from: week_start.getTime(),
      to: game_time,
      label: {
        text: `Week ${game.week}`,
        style: {
          color: '#606060'
        },
        align: 'left',
        x: 5,
        y: -10
      }
    })

    // Add break between seasons
    if (index > 0 && game.year !== game_info[index - 1].year) {
      const previous_game_time = game_info[index - 1].game_time
      const break_start = previous_game_time + 24 * 60 * 60 * 1000 // 1 day after previous game
      const break_end = week_start.getTime() - 24 * 60 * 60 * 1000 // 1 day before current week start

      axis_breaks.push({
        from: break_start,
        to: break_end,
        breakSize: 86400000 // 1 day in milliseconds
      })
    }
  })

  return { plot_lines, plot_bands, axis_breaks }
}

function create_x_axis({ game_info, plot_lines, plot_bands, axis_breaks }) {
  if (game_info.length > 0) {
    return {
      type: 'datetime',
      plotLines: plot_lines,
      plotBands: plot_bands,
      labels: {
        rotation: -45,
        align: 'right',
        y: 25,
        formatter: function () {
          const game = game_info.find((g) => g.game_time === this.value)
          if (game) {
            return `${game.away_team} @ ${game.home_team}`
          }
          return Highcharts.dateFormat('%d %b', this.value)
        }
      },
      tickPositions: game_info.map((g) => g.game_time),
      breaks: axis_breaks
    }
  } else {
    return {
      type: 'datetime',
      plotLines: plot_lines,
      plotBands: plot_bands
    }
  }
}

function categorize_markets(market_options) {
  const categorized = {
    season: [],
    game: [],
    unprocessed: []
  }
  market_options.forEach((market) => {
    if (market.startsWith('SEASON_')) {
      categorized.season.push(market)
    } else if (market.startsWith('GAME_')) {
      categorized.game.push(market)
    } else {
      categorized.unprocessed.push(market)
    }
  })

  return categorized
}

export default function SelectedPlayerMarkets({
  player_map,
  load_player_betting_markets,
  grouped_markets
}) {
  const pid = player_map.get('pid')
  const [selected_market, set_selected_market] = useState(null)

  useEffect(() => {
    load_player_betting_markets(pid)
  }, [pid, load_player_betting_markets])

  const market_options = useMemo(() => {
    return Object.keys(grouped_markets)
  }, [grouped_markets])

  const categorized_markets = useMemo(() => {
    return categorize_markets(market_options)
  }, [market_options])

  const sorted_market_options = useMemo(() => {
    return [
      ...categorized_markets.season,
      ...categorized_markets.game,
      ...categorized_markets.unprocessed
    ]
  }, [categorized_markets])

  useEffect(() => {
    if (sorted_market_options.length > 0 && !selected_market) {
      set_selected_market(sorted_market_options[0])
    }
  }, [sorted_market_options, selected_market])

  return (
    <div className='selected-player-markets'>
      <Autocomplete
        options={sorted_market_options}
        groupBy={(option) => {
          if (categorized_markets.season.includes(option)) return 'Season'
          if (categorized_markets.game.includes(option)) return 'Game'
          return 'Other'
        }}
        getOptionLabel={(option) => option.replace(/_/g, ' ').toUpperCase()}
        value={selected_market}
        onChange={(event, new_value) => set_selected_market(new_value)}
        renderInput={(params) => (
          <TextField {...params} label='Select Market' />
        )}
      />
      {selected_market && (
        <MarketCard
          market_name={selected_market}
          markets={grouped_markets[selected_market]}
        />
      )}
    </div>
  )
}

SelectedPlayerMarkets.propTypes = {
  player_map: ImmutablePropTypes.map.isRequired,
  load_player_betting_markets: PropTypes.func.isRequired,
  grouped_markets: PropTypes.object.isRequired
}
