import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useParams, useNavigate } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'

import PageLayout from '@layouts/page'
import SelectYear from '@components/select-year'
import ScoreboardSelectWeek from '@components/scoreboard-select-week'
import ScoreboardScores from '@components/scoreboard-scores'
import ScoreboardTeam from '@components/scoreboard-team'
import ScoreboardOverTime from '@components/scoreboard-over-time'
import ScoreboardPlayByPlay from '@components/scoreboard-play-by-play'
import ScoreboardSlots from '@components/scoreboard-slots'
import ScoreboardTeams from '@components/scoreboard-teams'
import { constants } from '@common'

import './matchup.styl'

export default function MatchupPage({
  matchup,
  year,
  loadMatchups,
  loadLeaguePlayers,
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
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    if (seas_year && isNaN(seas_year)) {
      return navigate('/', { replace: true })
    }

    if (seas_week && isNaN(seas_week)) {
      return navigate('/', { replace: true })
    }

    if (matchupId && isNaN(matchupId)) {
      return navigate('/', { replace: true })
    }

    if (seas_year) selectYear(seas_year)
    if (seas_week) selectWeek(seas_week)

    if (matchupId) selectMatchup(matchupId)

    loadLeaguePlayers()
  }, [])

  useEffect(() => {
    loadMatchups()
  }, [year])

  useEffect(() => {
    set_selected_tid(isHeadToHead ? matchup.hid : matchup.getIn(['tids', '0']))
    navigate(
      `/leagues/${matchup.lid}/matchups/${matchup.year}/${matchup.week}/${matchup.uid}`
    )
  }, [matchup.uid])

  const body = (
    <Container maxWidth='lg'>
      <Grid container spacing={0}>
        <Grid item xs={12}>
          <Stack direction='row' spacing={1} sx={{ paddingTop: '32px' }}>
            <SelectYear />
            <ScoreboardSelectWeek />
          </Stack>
        </Grid>
        <Grid item xs={12}>
          {isHeadToHead && <ScoreboardScores />}
        </Grid>
        <Grid container item xs={12} spacing={0}>
          <Grid item xs={12} md={9}>
            {!isHeadToHead && (
              <ScoreboardTeams
                onClick={set_selected_tid}
                selected={show_bench}
              />
            )}
            <div className='scoreboard__main'>
              {isHeadToHead && (
                <ScoreboardTeam
                  tid={matchup.aid}
                  type='away'
                  showBench={show_bench}
                />
              )}
              <ScoreboardSlots />
              <ScoreboardTeam
                tid={selected_tid}
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
      </Grid>
    </Container>
  )

  return <PageLayout body={body} scroll />
}

MatchupPage.propTypes = {
  year: PropTypes.number,
  matchup: ImmutablePropTypes.record,
  selectYear: PropTypes.func,
  selectWeek: PropTypes.func,
  loadMatchups: PropTypes.func,
  selectMatchup: PropTypes.func,
  loadLeaguePlayers: PropTypes.func
}