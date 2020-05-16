import React from 'react'
// import hotkeys from 'hotkeys-js'

import Menu from '@components/menu'
import Routes from '@views/routes'
import Loading from '@components/loading'
import { localStorageAdapter } from '@core/utils'
import Button from '@components/button'

import 'normalize.css'
import '@styles/normalize.css'
import '@styles/index.styl'
import './app.styl'

class App extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      menu: 'login'
    }

    this.handleSubmit = this.handleSubmit.bind(this)
    // TODO add general keyboard shortcuts
  }

  async componentDidMount () {
    const token = await localStorageAdapter.getItem('token')
    this.props.init(token)
  }

  handleSubmit (event) {
    event.preventDefault()
    const data = {
      email: event.target.email.value,
      password: event.target.password.value
    }
    if (this.state.menu === 'login') {
      this.props.login(data)
    } else {
      this.props.register(data)
    }
  }

  setMenu (menu) {
    this.setState({ menu })
  }

  render () {
    const { isPending, userId } = this.props
    if (isPending) {
      return <Loading loading={isPending} />
    }

    if (typeof userId === 'undefined') {
      return (
        <main>
          <div className='menu'>
            <Button
              isActive={this.state.menu === 'login'}
              onClick={() => this.setMenu('login')}
            >
              Login
            </Button>
            <Button
              isActive={this.state.menu === 'register'}
              onClick={() => this.setMenu('register')}
            >
              Register
            </Button>
          </div>
          <form id='auth' onSubmit={this.handleSubmit}>
            <label>
              Email
              <input
                type='email'
                name='email'
                placeholder='email'
              />
            </label>
            <label>
              Password
              <input
                type='password'
                name='password'
              />
            </label>
            <Button type='submit' isLoading={this.props.isUpdating}>Submit</Button>
          </form>
        </main>
      )
    }

    return (
      <main>
        <Menu />
        <Routes />
      </main>
    )
  }
}

export default App
