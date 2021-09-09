import React from 'react'
import PropTypes from 'prop-types'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'

import PlayerNameExpanded from '@components/player-name-expanded'
import TeamName from '@components/team-name'

import './waiver-report-item.styl'

function AlternateClaims({ waivers }) {
  if (!waivers.length) {
    return null
  }

  const items = []
  for (const [index, item] of waivers.entries()) {
    items.push(
      <TableRow key={index}>
        <TableCell className='metric'>${item.bid}</TableCell>
        <TableCell>
          <TeamName tid={item.tid} />
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

    console.log(waiver)

    return (
      <div className='waiver__report-item'>
        <div className='waiver__report-item-head'>
          <div className='waiver__report-item-winning-bid metric'>
            ${waiver.bid}
          </div>
          <div className='waiver__report-meta'>
            <TeamName tid={waiver.tid} />
            <PlayerNameExpanded playerId={waiver.player} hideActions />
          </div>
        </div>
        <AlternateClaims waivers={waiver.waivers} />
      </div>
    )
  }
}

WaiverReportItem.propTypes = {
  waiver: PropTypes.object
}
