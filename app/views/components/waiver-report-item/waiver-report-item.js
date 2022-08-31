import React from 'react'
import PropTypes from 'prop-types'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import PlayerNameExpanded from '@components/player-name-expanded'
import TeamName from '@components/team-name'

import './waiver-report-item.styl'

function AlternateClaims({ waivers }) {
  if (!waivers.length) {
    return null
  }

  const sorted = waivers.sort((a, b) => b.bid - a.bid)

  const items = []
  for (const [index, item] of sorted.entries()) {
    items.push(
      <TableRow key={index}>
        <TableCell className='metric'>${item.bid}</TableCell>
        <TableCell>
          <TeamName tid={item.tid} abbrv />
        </TableCell>
        <TableCell>{item.reason}</TableCell>
      </TableRow>
    )
  }

  return (
    <TableContainer>
      <Table size='small'>
        <TableHead>
          <TableRow>
            <TableCell>Bid</TableCell>
            <TableCell>Team</TableCell>
            <TableCell>Reason Failed</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>{items}</TableBody>
      </Table>
    </TableContainer>
  )
}

AlternateClaims.propTypes = {
  waivers: PropTypes.array
}

export default class WaiverReportItem extends React.Component {
  render = () => {
    const { waiver } = this.props

    return (
      <div className='waiver__report-item'>
        <div className='waiver__report-team'>
          {waiver.tid ? (
            <TeamName tid={waiver.tid} />
          ) : (
            <div className='team__name'>Free Agent</div>
          )}
        </div>
        <div className='waiver__report-item-head'>
          <div className='waiver__report-item-winning-bid metric'>
            ${waiver.bid || 0}
          </div>
          <div className='waiver__report-meta'>
            <PlayerNameExpanded pid={waiver.pid} hideActions headshot_square />
          </div>
        </div>
        <div className='waiver__report-claims'>
          <AlternateClaims waivers={waiver.waivers} />
        </div>
      </div>
    )
  }
}

WaiverReportItem.propTypes = {
  waiver: PropTypes.object
}
