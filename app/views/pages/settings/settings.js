import React from 'react'

import EditableLeague from '@components/editable-league'
import EditableTeam from '@components/editable-team'
import EditableSource from '@components/editable-source'
import PageLayout from '@layouts/page'
import EditableValue from '@components/editable-value'

import './settings.styl'

export default class SettingsPage extends React.Component {
  render = () => {
    const { leagueIds, teamIds, sourceIds } = this.props

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

    const body = (
      <div className='settings'>
        {leagueItems}
        <div className='settings__section'>
          <div className='settings__section-head'>Teams</div>
          <div className='settings__section-body'>{teamItems}</div>
        </div>
        <div className='settings__section'>
          <div className='settings__section-head'>Value Calculations</div>
          <EditableValue />
          <div className='editable__league-section-title'>Projection Weights</div>
          <div className='settings__section-body'>{sourceItems}</div>
        </div>
      </div>
    )
    return (
      <PageLayout body={body} scroll />
    )
  }
}
