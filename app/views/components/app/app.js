import React from 'react'
import queryString from 'query-string'
// import hotkeys from 'hotkeys-js'

import Menu from '@components/menu'
import Routes from '@views/routes'
import Loading from '@components/loading'
import { localStorageAdapter } from '@core/utils'
import Button from '@components/button'
import TextField from '@material-ui/core/TextField'
import Logout from '@components/logout'

import 'normalize.css'
import '@styles/normalize.css'
import '@styles/index.styl'
import './app.styl'

class App extends React.Component {
  constructor (props) {
    super(props)

    const { leagueId } = queryString.parse(this.props.location.search)

    this.state = {
      menu: leagueId ? 'register' : 'login',
      passwordError: false
    }

    this.passwordRef = React.createRef()
    this.password2Ref = React.createRef()
    // TODO add general keyboard shortcuts
  }

  async componentDidMount () {
    const token = await localStorageAdapter.getItem('token')
    this.props.init(token)
  }

  handleSubmit = (event) => {
    event.preventDefault()
    const { leagueId, teamId } = queryString.parse(this.props.location.search)
    const data = {
      email: event.target.email.value,
      password: event.target.password.value,
      leagueId,
      teamId
    }
    if (this.state.menu === 'login') {
      this.props.login(data)
    } else if (
      this.password2Ref.current.value &&
        this.passwordRef.current.value === this.password2Ref.current.value) {
      this.props.register(data)
    }
  }

  handleClick = () => {
    this.setState({
      passwordError: false,
      menu: this.state.menu === 'login' ? 'register' : 'login'
    })
  }

  handleChange = () => {
    if (this.state.menu === 'login') return
    this.setState({
      passwordError: this.passwordRef.current.value !== this.password2Ref.current.value
    })
  }

  render () {
    const { leagueId, teamId } = queryString.parse(this.props.location.search)
    const { isPending, userId, authError } = this.props
    if (isPending) {
      return <Loading loading={isPending} />
    }

    if (typeof userId === 'undefined') {
      return (
        <main>
          <div className='auth'>
            <div className='auth__side' />
            <div className='auth__main'>
              <form id='auth' onSubmit={this.handleSubmit}>
                {authError}
                {leagueId &&
                  <TextField
                    disabled
                    label='League Id'
                    variant='outlined'
                    value={leagueId}
                  />}
                {teamId &&
                  <TextField
                    disabled
                    label='Team Id'
                    variant='outlined'
                    value={teamId}
                  />}
                <TextField
                  id='email'
                  label='Email Address'
                  type='email'
                  error={!!authError}
                  variant='outlined'
                />
                <TextField
                  error={!!authError || this.state.passwordError}
                  helperText={this.state.passwordError && 'Password does not match'}
                  id='password'
                  label='Password'
                  type='password'
                  inputRef={this.passwordRef}
                  onChange={this.handleChange}
                  variant='outlined'
                />
                {this.state.menu === 'register' &&
                  <TextField
                    error={!!authError || this.state.passwordError}
                    helperText={this.state.passwordError && 'Password does not match'}
                    id='password2'
                    label='Confirm Password'
                    type='password'
                    inputRef={this.password2Ref}
                    onChange={this.handleChange}
                    variant='outlined'
                  />}
                <Button type='submit' isLoading={isPending}>
                  {this.state.menu}
                </Button>
              </form>
              <Button className='auth__toggle button__text' onClick={this.handleClick}>
                {this.state.menu === 'register' ? 'login' : 'register'}
              </Button>
            </div>
          </div>
        </main>
      )
    }

    return (
      <main>
        <Menu />
        <Routes />
        <Logout />
      </main>
    )
  }
}

export default App
