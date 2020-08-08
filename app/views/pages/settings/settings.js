import React from 'react'

import EditableLeague from '@components/editable-league'
import EditableTeam from '@components/editable-team'
import EditableSource from '@components/editable-source'
import EditableBaseline from '@components/editable-baseline'
import PageLayout from '@layouts/page'
import EditableValue from '@components/editable-value'
import SettingsSwitch from '@components/settings-switch'

import './settings.styl'

export default class SettingsPage extends React.Component {
  render = () => {
    const { userId, leagueIds, teamIds, sourceIds, baselines, vbaseline } = this.props

    const leagueItems = []
    for (const leagueId of leagueIds) {
      leagueItems.push(
        <EditableLeague key={leagueId} lid={leagueId} />
      )
    }

    const teamItems = []
    for (const teamId of teamIds) {
      teamItems.push(
        <EditableTeam key={teamId} tid={teamId} />
      )
    }

    const sourceItems = []
    for (const sourceId of sourceIds) {
      sourceItems.push(
        <EditableSource key={sourceId} sourceId={sourceId} />
      )
    }

    const editableBaselines = []
    for (const baseline in baselines) {
      editableBaselines.push(<EditableBaseline key={baseline} position={baseline} />)
    }

    let baselineDescription
    switch (vbaseline) {
      case 'available':
        baselineDescription = (<p><strong>Best Available: </strong> The best available player at each position that can be added. This is estimated when rosters are not full but dynamically updates with each roster transaction.</p>)
        break

      case 'bench':
        baselineDescription = (<p><strong>Average Bench: </strong> The average player at each position on a teams bench</p>)
        break

      case 'starter':
        baselineDescription = (<p><strong>Worst Starter: </strong> The worst player at each position on a starting lineup</p>)
        break

      case 'average':
        baselineDescription = (<p><strong>Average Starter: </strong> The average player at each position on a starting lineup</p>)
        break

      case 'hybrid':
        baselineDescription = (<p><strong>Hybrid</strong> allows for you to mix <strong>Best Available</strong> and <strong>Worst Starter</strong> based on specified weights. Weights are relative and normalized, thus equal weight values are the same as each having a weight of 1.</p>)
        break

      case 'manual':
        baselineDescription = (<p><strong>Manual</strong> allows you to set the baseline for each position. Not recommended during the season.</p>)
        break
    }

    const body = (
      <div className='settings'>
        {leagueItems}
        {!!teamItems.length &&
          <div className='settings__section'>
            <div className='settings__section-head'>Teams</div>
            <div className='settings__section-body'>{teamItems}</div>
          </div>}
        <div className='settings__section'>
          <div className='settings__section-head'>Value Calculations</div>
          <EditableValue />
          <div className='settings__help'>
            {baselineDescription}
            <p>The baseline (aka replacement player) used for value over replacement calculations. Since only points from starters count, the <strong>worst starter</strong> baseline is the best baseline to use when determining historical value. When forecasting value, there is no right answer, it depends on strategy. <strong>Best Available</strong> will emphasize depth, whereas <strong>Worst Starter</strong> will emphasize the value of high-end starters and even more so for <strong>Average Starter</strong>.</p>
          </div>
          {vbaseline !== 'hybrid' && editableBaselines}
          <div className='editable__league-section-title'>Projection Weights</div>
          <div className='settings__section-body'>{sourceItems}</div>
        </div>
        {userId &&
          <div className='settings__section settings__notifications'>
            <div className='settings__section-head'>Notifications</div>
            <div className='settings__section-body'>
              <SettingsSwitch
                field='text'
                label='Text Notifications'
                description='Enable/disable all text notifications.'
              />
              <SettingsSwitch
                field='voice'
                label='Voice Notifications'
                description='Enable/disable all voice notifications.'
              />
            </div>
          </div>}
      </div>
    )

    return (
      <PageLayout body={body} scroll />
    )
  }
}
