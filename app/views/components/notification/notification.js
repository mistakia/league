import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Snackbar from '@mui/material/Snackbar'
import MuiAlert from '@mui/material/Alert'

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant='filled' {...props} />
})

export default class Notification extends React.Component {
  constructor(props) {
    super(props)

    const { key } = props.info
    this.state = {
      open: Boolean(key),
      info: key ? props.info.toJS() : undefined,
      list: []
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.info.key !== this.props.info.key) {
      this.setState({ list: [...this.state.list, this.props.info.toJS()] })
    }

    if (this.state.list.length && !this.state.info) {
      this.setState({ info: this.state.list[0] })
      this.setState({ list: this.state.list.slice(1), open: true })
    } else if (this.state.list.length && this.state.info && this.state.open) {
      this.setState({ open: false })
    }
  }

  handleExited = () => {
    this.setState({ info: undefined })
  }

  handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return
    }

    this.setState({ open: false })
  }

  render = () => {
    const { info } = this.state
    return (
      <Snackbar
        key={info ? info.key : undefined}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        open={this.state.open}
        autoHideDuration={6000}
        onClose={this.handleClose}
        TransitionProps={{ onExited: this.handleExited }}
        message={info && !info.severity ? info.message : undefined}
      >
        {info && info.severity && (
          <Alert severity={info ? info.severity : undefined}>
            {info ? info.message : undefined}
          </Alert>
        )}
      </Snackbar>
    )
  }
}

Notification.propTypes = {
  info: ImmutablePropTypes.record
}
