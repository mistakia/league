import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import PageLayout from '@layouts/page'

export default function UserWagersPage({ loadUserWagers }) {
  const { username } = useParams()

  useEffect(() => {
    loadUserWagers({ username })
  }, [username, loadUserWagers])

  let body = <div>{username} wagers</div>
  return <PageLayout body={body} scroll />
}
