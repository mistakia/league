import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PropTypes from 'prop-types'
import Container from '@mui/material/Container'

import Loading from '@components/loading'
import WaiverTypeFilter from '@components/waiver-type-filter'
import WaiverProcessedFilter from '@components/waiver-processed-filter'
import WaiverReportItem from '@components/waiver-report-item'
import PageLayout from '@layouts/page'

import './waivers.styl'

export default function WaiversPage({ load, items, isPending }) {
  const { lid } = useParams()

  useEffect(() => {
    load(lid)
  }, [])

  const rows = []
  items.forEach((waiver, index) => {
    rows.push(<WaiverReportItem key={index} waiver={waiver} />)
  })

  const body = (
    <Container maxWidth='sm'>
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

WaiversPage.propTypes = {
  load: PropTypes.func,
  items: PropTypes.array,
  isPending: PropTypes.bool
}
