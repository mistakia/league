import React from 'react'

import PageLayout from '@layouts/page'
import Roster from '@components/roster'

import './rosters.styl'

export default class RostersPage extends React.Component {
  componentDidMount = () => {
    this.props.load()
  }

  render = () => {
    const { rosters } = this.props

    const items = []
    for (const roster of rosters.values()) {
      items.push(<Roster roster={roster} />)
    }

    const body = (
      <div className='rosters'>
        {items}
      </div>
    )

    return (
      <PageLayout body={body} scroll />
    )
  }
}
