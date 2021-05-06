import React from 'react'
import Container from '@material-ui/core/Container'

import Lineup from '@components/lineup'
import PageLayout from '@layouts/page'

export default function () {
  const { roster } = this.props
  const body = (
    <Container maxWidth='lg'>
      <Lineup roster={roster} />
    </Container>
  )

  return <PageLayout body={body} scroll />
}
