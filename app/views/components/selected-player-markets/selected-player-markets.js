import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import FormControl from '@mui/material/FormControl'

import './selected-player-markets.styl'

function MarketCard({ market_name, markets }) {
  const is_alt_line = market_name.includes('ALT')
  const [selected_line, set_selected_line] = useState('')

  const lines = useMemo(() => {
    if (!is_alt_line) return null
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
    () => create_chart_options({ markets: filtered_markets }),
    [filtered_markets, is_alt_line]
  )

  const table_data = useMemo(
    () => create_table_data({ markets: filtered_markets, is_alt_line }),
    [filtered_markets, is_alt_line]
  )

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
        <TableHeader has_line={false} />
        <TableBody table_data={table_data} has_line={false} />
      </div>
    </div>
  )
}

MarketCard.propTypes = {
  market_name: PropTypes.string,
  markets: PropTypes.array.isRequired
}

function check_has_line(markets) {
  return markets.some((market) =>
    market.selections.some(
      (selection) => selection.selection_metric_line !== null
    )
  )
}

function create_table_data({ markets, is_alt_line }) {
  const combined_data = {}
  const has_line = check_has_line(markets)

  markets.forEach((market) => {
    market.selections.forEach((selection) => {
      const key = `${market.source_id}_${selection.timestamp}_${market.year}_${market.week}`
      if (!combined_data[key]) {
        combined_data[key] = {
          source: market.source_id,
          timestamp: new Date(selection.timestamp * 1000).toLocaleString(),
          year: market.year,
          week: market.week
        }

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

  return Object.values(combined_data).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  )
}

function TableHeader({ has_line }) {
  return (
    <>
      <div className='selected__table-header sticky__column'>
        <div className='row__group-head'>Market Data</div>
      </div>
      <div className='selected__table-header sticky'>
        <div className='table__cell source'>Source</div>
        {has_line ? (
          <>
            <div className='table__cell'>Line</div>
            <div className='table__cell'>Over</div>
            <div className='table__cell'>Under</div>
            <div className='table__cell'>Year</div>
            <div className='table__cell'>Week</div>
          </>
        ) : (
          <div className='table__cell'>Odds</div>
        )}
        <div className='table__cell timestamp'>Timestamp</div>
      </div>
    </>
  )
}

TableHeader.propTypes = {
  has_line: PropTypes.bool.isRequired
}

function TableBody({ table_data, has_line }) {
  return (
    <>
      {table_data.map((row, index) => (
        <div key={index} className='table__row'>
          <div className='table__cell source'>{row.source}</div>
          {has_line ? (
            <>
              <div className='table__cell'>{row.line}</div>
              <div className='table__cell'>{row.over_odds}</div>
              <div className='table__cell'>{row.under_odds}</div>
              <div className='table__cell'>{row.year}</div>
              <div className='table__cell'>{row.week}</div>
            </>
          ) : (
            <div className='table__cell'>{row.odds}</div>
          )}
          <div className='table__cell timestamp'>{row.timestamp}</div>
        </div>
      ))}
    </>
  )
}

TableBody.propTypes = {
  table_data: PropTypes.array.isRequired,
  has_line: PropTypes.bool.isRequired
}

function create_chart_options({ markets }) {
  return create_odds_only_chart({ markets })
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
  const { plot_lines, plot_bands } = create_plot_annotations(game_info)

  return {
    chart: {
      type: 'line',
      spacingBottom: 50,
      spacingTop: 50
    },
    title: {
      text: ''
    },
    xAxis: create_x_axis({ game_info, plot_lines, plot_bands }),
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
    ],
    tooltip: {
      shared: true,
      crosshairs: true
    }
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
  })

  return { plot_lines, plot_bands }
}

function create_x_axis({ game_info, plot_lines, plot_bands }) {
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
      tickPositions: game_info.map((g) => g.game_time)
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
