import React from 'react'
import { AutoSizer, Table, Column } from 'react-virtualized'
import TableRow from '@material-ui/core/TableRow'
import TableCell from '@material-ui/core/TableCell'

import PositionFilter from '@components/position-filter'
import PageLayout from '@layouts/page'

import './players.styl'

const ROW_HEIGHT = 53

export default function () {
  const { players } = this.props

  const Row = ({ index, rowData: player, style, className, columns }) => {
    console.log(className)
    return (
      <TableRow style={style} className={className} component='div' key={index}>
        <TableCell component='div'>{player.name}</TableCell>
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
          <Column label='Name' dataKey='name' width={100} />
        </Table>
      )}
    </AutoSizer>
  )

  return (
    <PageLayout body={body} menu={menu} />
  )
}
