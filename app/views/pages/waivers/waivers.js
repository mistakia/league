import React from 'react'
import PropTypes from 'prop-types'
import Container from '@material-ui/core/Container'

import Loading from '@components/loading'
import WaiverTypeFilter from '@components/waiver-type-filter'
import WaiverProcessedFilter from '@components/waiver-processed-filter'
import WaiverReportItem from '@components/waiver-report-item'
import PageLayout from '@layouts/page'

import './waivers.styl'

export default class WaiversPage extends React.Component {
  componentDidMount = () => {
    this.props.load()
  }

  render = () => {
    const { items, isPending } = this.props

    const rows = []
    for (const [index, waiver] of items.entries()) {
      rows.push(<WaiverReportItem key={index} waiver={waiver} />)
    }

    const body = (
      <Container maxWidth='sm' classes={{ root: 'waivers' }}>
        <div className='waivers__filter'>
          <WaiverTypeFilter />
          <WaiverProcessedFilter />
        </div>
        <div className='waivers__body empty'>
          {isPending && <Loading loading />}
          {rows}
        </div>
      </Container>
    )

    return <PageLayout body={body} scroll />
  }
}

WaiversPage.propTypes = {
  load: PropTypes.func,
  items: PropTypes.array,
  isPending: PropTypes.bool
}
