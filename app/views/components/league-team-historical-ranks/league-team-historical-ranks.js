import React from 'react'
import PropTypes from 'prop-types'

import MetricCard from '@components/metric-card'

import './league-team-historical-ranks.styl'

export default function LeagueTeamHistoricalRanks({ historical_ranks }) {
  return (
    <div className='league-team-historical-ranks'>
      <MetricCard
        label='Wins'
        value={historical_ranks.wins}
        rank={historical_ranks.wins_rank}
      />
      <MetricCard
        label='All Play Wins'
        value={historical_ranks.apWins}
        rank={historical_ranks.apWins_rank}
      />
      <MetricCard
        label='Total Points'
        value={historical_ranks.pf}
        rank={historical_ranks.pf_rank}
      />
      <MetricCard
        label='Post Seasons'
        value={historical_ranks.post_seasons}
        rank={historical_ranks.post_seasons_rank}
      />
      <MetricCard
        label='Championships'
        value={historical_ranks.championships}
        rank={historical_ranks.championships_rank}
      />
    </div>
  )
}

LeagueTeamHistoricalRanks.propTypes = {
  historical_ranks: PropTypes.object.isRequired
}
