import React from 'react'
import PropTypes from 'prop-types'

import PlayerContextMenu from '@components/player-context-menu'

import './context-menu.styl'

export default class ContextMenu extends React.Component {
  handleClick = (event) => {
    const visible = this.props.contextMenuInfo.get('visible')
    if (!visible) {
      return
    }

    const wasOutside = !this.root.contains(event.target)
    if (wasOutside) {
      this.props.hide()
    }
  }

  removeListeners = () => {
    document.removeEventListener('click', this.handleClick)
  }

  addListeners = () => {
    document.addEventListener('click', this.handleClick)
  }

  componentWillUnmount = () => {
    this.removeListeners()
  }

  componentDidUpdate = () => {
    const visible = this.props.contextMenuInfo.get('visible')
    const clickX = this.props.contextMenuInfo.get('clickX')
    const clickY = this.props.contextMenuInfo.get('clickY')

    if (!visible || !this.root) {
      return this.removeListeners()
    }

    this.addListeners()

    const rootW = this.root.offsetWidth
    const rootH = this.root.offsetHeight
    const screenW = window.innerWidth
    const screenH = window.innerHeight

    if (screenW <= 600) {
      this.root.style.left = '0px'
      this.root.style.right = '0px'
      this.root.style.bottom = '0px'
      this.root.style.top = 'auto'
      return
    }

    const right = screenW - clickX > rootW
    const left = !right
    const top = screenH - clickY > rootH
    const bottom = !top

    if (right) {
      this.root.style.left = `${clickX + 5}px`
    }

    if (left) {
      this.root.style.left = `${clickX - rootW - 5}px`
    }

    if (top) {
      this.root.style.top = `${clickY + 5}px`
    }

    if (bottom) {
      this.root.style.top = `${clickY - rootH - 5}px`
      this.root.classList.add('bottom')
    }
  }

  render = () => {
    const visible = this.props.contextMenuInfo.get('visible')
    const id = this.props.contextMenuInfo.get('id')
    const data = this.props.contextMenuInfo.get('data')

    if (!visible) {
      return null
    }

    const getContextMenuComponent = (id) => {
      switch (id) {
        case 'player':
          return PlayerContextMenu
      }
    }

    const ContextMenuComponent = getContextMenuComponent(id)

    return (
      <div>
        <div
          ref={(ref) => {
            this.root = ref
          }}
          className='context__menu'
        >
          <ContextMenuComponent {...data} />
        </div>
        <div className='context__menu-backdrop' />
      </div>
    )
  }
}

ContextMenu.propTypes = {
  contextMenuInfo: PropTypes.object,
  hide: PropTypes.func
}
