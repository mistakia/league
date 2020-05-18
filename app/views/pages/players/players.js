import React from 'react'
import { AutoSizer, Table, Column } from 'react-virtualized'
import TableRow from '@material-ui/core/TableRow'
import TableCell from '@material-ui/core/TableCell'

import PositionFilter from '@components/position-filter'
import PageLayout from '@layouts/page'

import './players.styl'

const ROW_HEIGHT = 53

function descendingComparator (a, b, orderBy) {
  const keyPath = orderBy.split('.')
  const aValue = a.getIn(keyPath)
  const bValue = b.getIn(keyPath)
  if (bValue < aValue) {
    return -1
  }
  if (bValue > aValue) {
    return 1
  }
  return 0
}

function getComparator (order, orderBy) {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy)
}

export default function () {
  const { order, orderBy } = this.state
  let { players } = this.props

  players = players.sort(getComparator(order, orderBy))

  const Row = ({ index, rowData, style, className, columns }) => {
    const player = rowData.toJS()
    return (
      <TableRow style={style} className={className} component='div' key={index}>
        <TableCell component='div'>{player.name}</TableCell>
        <TableCell component='div'>{player.pos1}</TableCell>
        <TableCell component='div'>${player.values.starter}</TableCell>
        <TableCell component='div'>${player.values.available}</TableCell>

        <TableCell component='div'>{(player.vorp.starter || 0).toFixed(1)}</TableCell>
        <TableCell component='div'>{(player.vorp.available || 0).toFixed(1)}</TableCell>

        <TableCell component='div'>{(player.points.total || 0).toFixed(1)}</TableCell>
      </TableRow>
    )
  }

  const menu = (
    <PositionFilter />
  )

  const body = (
    <AutoSizer>
      {({ height, width }) => (
        <Table
          className='players'
          width={width}
          height={height}
          headerHeight={20}
          rowHeight={ROW_HEIGHT}
          rowCount={players.size}
          rowRenderer={Row}
          rowGetter={({ index }) => players.get(index)}
        >
          <Column label='Name' dataKey='name' width={150} />
          <Column label='VORP' dataKey='values.starter' width={25} />
          <Column label='v FA' dataKey='values.available' width={25} />
        </Table>
      )}
    </AutoSizer>
  )

  return (
    <PageLayout body={body} menu={menu} />
  )
}
