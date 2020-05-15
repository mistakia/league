import React from 'react'
import TableRow from '@material-ui/core/TableRow'
import TableCell from '@material-ui/core/TableCell'

class Player extends React.Component {
  render () {
    console.log(this.props)
    const { player, style, className } = this.props

    return (
      <TableRow style={style} className={className} component='div'>
        <TableCell component='div'>{player.name}</TableCell>
      </TableRow>
    )
  }
}

export default Player
