import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useParams, useNavigate } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'

import Loading from '@components/loading'
import PageLayout from '@layouts/page'
import SelectYear from '@components/select-year'
import ScoreboardSelectWeek from '@components/scoreboard-select-week'
import ScoreboardScores from '@components/scoreboard-scores'
import ScoreboardTeam from '@components/scoreboard-team'
import ScoreboardOverTime from '@components/scoreboard-over-time'
import ScoreboardPlayByPlay from '@components/scoreboard-play-by-play'
import ScoreboardSlots from '@components/scoreboard-slots'
import ScoreboardTeams from '@components/scoreboard-teams'
import { constants } from '@libs-shared'

import './matchup.styl'

export default function MatchupPage({
  is_loading,
  matchup,
  year,
  week,
  loadMatchups,
  loadLeaguePlayers,
  loadRosters,
  selectWeek,
  selectYear,
  selectMatchup
}) {
  const isHeadToHead = matchup.type === constants.matchups.H2H
  const navigate = useNavigate()
  const [show_bench, set_show_bench] = useState(false)
  const { lid, seas_year, seas_week, matchupId } = useParams()
  const [selected_tid, set_selected_tid] = useState(
    isHeadToHead ? matchup.hid : matchup.getIn(['tids', '0'])
  )

  useEffect(() => {
    if (matchupId && isNaN(matchupId)) {
      return navigate('/', { replace: true })
    }

    if (seas_year && isNaN(seas_year)) {
      return navigate('/', { replace: true })
    }

    if (seas_week && isNaN(seas_week)) {
      return navigate('/', { replace: true })
    }

    if (matchupId)
      selectMatchup({ matchupId, year: seas_year, week: seas_week })
    else if (seas_week) selectWeek(seas_week)
    else if (seas_year) selectYear(seas_year)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seas_year, seas_week, matchupId, selectYear, selectWeek, selectMatchup])

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    loadLeaguePlayers()
    loadRosters(lid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lid, loadLeaguePlayers, loadRosters])

  useEffect(() => {
    if (seas_week && Number(seas_week) !== week) {
      return
    }

    if (seas_year && Number(seas_year) !== year) {
      return
    }

    loadMatchups({ year, week })
  }, [year, week, seas_week, seas_year, loadMatchups])

  useEffect(() => {
    set_selected_tid(isHeadToHead ? matchup.hid : matchup.getIn(['tids', '0']))
    if (matchup.uid) {
      navigate(
        `/leagues/${matchup.lid}/matchups/${matchup.year}/${matchup.week}/${matchup.uid}`
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchup, isHeadToHead])

  let matchup_body
  if (is_loading) {
    matchup_body = <Loading loading={is_loading} />
  } else if (!matchup.uid) {
    matchup_body = <div className='scoreboard__empty empty' />
  } else {
    matchup_body = (
      <>
        <Grid item xs={12}>
          {isHeadToHead && <ScoreboardScores />}
        </Grid>
        <Grid container item xs={12} spacing={0}>
          <Grid item xs={12} md={9}>
            {!isHeadToHead && (
              <ScoreboardTeams
                onClick={set_selected_tid}
                selected_tid={selected_tid}
              />
            )}
            <div className='scoreboard__main'>
              {isHeadToHead && (
                <ScoreboardTeam
                  tid={matchup.aid}
                  week={matchup.week}
                  type='away'
                  showBench={show_bench}
                />
              )}
              <ScoreboardSlots />
              <ScoreboardTeam
                tid={selected_tid}
                week={matchup.week}
                type='home'
                showBench={show_bench}
              />
            </div>
            <div
              className='scoreboard__bench cursor'
              onClick={() => set_show_bench(!show_bench)}
            >
              Show Bench
            </div>
          </Grid>
          <Grid item xs={12} md={3}>
            <ScoreboardPlayByPlay mid={matchup.uid} />
          </Grid>
        </Grid>
        <Grid container item xs={12} spacing={0}>
          <Grid item xs={12}>
            <ScoreboardOverTime mid={matchup.uid} />
          </Grid>
        </Grid>
      </>
    )
  }

  const body = (
    <div className='league-container large'>
      <Grid container spacing={0}>
        <Grid item xs={12}>
          <Stack direction='row' spacing={1} sx={{ paddingTop: '32px' }}>
            <SelectYear />
            <ScoreboardSelectWeek />
          </Stack>
        </Grid>
        {matchup_body}
      </Grid>
    </div>
  )

  return <PageLayout body={body} scroll />
}

MatchupPage.propTypes = {
  is_loading: PropTypes.bool,
  year: PropTypes.number,
  week: PropTypes.number,
  matchup: ImmutablePropTypes.record,
  selectYear: PropTypes.func,
  selectWeek: PropTypes.func,
  loadMatchups: PropTypes.func,
  selectMatchup: PropTypes.func,
  loadRosters: PropTypes.func,
  loadLeaguePlayers: PropTypes.func
}
