import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'

import Loading from '@components/loading'
import WaiverTypeFilter from '@components/waiver-type-filter'
import WaiverProcessedFilter from '@components/waiver-processed-filter'
import WaiverReportItem from '@components/waiver-report-item'
import PageLayout from '@layouts/page'

import './waivers.styl'

export default function WaiversPage({ load, items, isPending }) {
  const { lid } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    load(lid)
  }, [lid, load, navigate])

  const rows = []
  items.forEach((waiver, index) => {
    rows.push(<WaiverReportItem key={index} waiver={waiver} />)
  })

  const waiver_body = isPending && !rows.length ? <Loading loading /> : rows

  const body = (
    <div className='league-container waivers-container'>
      <div className='waivers__filter'>
        <WaiverTypeFilter />
        <WaiverProcessedFilter />
      </div>
      <div className='waivers__body empty'>{waiver_body}</div>
    </div>
  )

  return <PageLayout body={body} scroll />
}

WaiversPage.propTypes = {
  load: PropTypes.func,
  items: PropTypes.array,
  isPending: PropTypes.bool
}
