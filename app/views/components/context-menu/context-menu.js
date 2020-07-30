import React from 'react'

import RosterContextMenu from '@components/roster-context-menu'

import './context-menu.styl'

export default class ContextMenu extends React.Component {
  handleScroll = () => {
    this.props.hide()
  }

  handleClick = (event) => {
    const { visible } = this.props.contextMenuInfo
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
    document.removeEventListener('scroll', this.handleScroll, true)
  }

  addListeners = () => {
    document.addEventListener('click', this.handleClick)
    document.addEventListener('scroll', this.handleScroll, true)
  }

  componentWillUnmount = () => {
    this.removeListeners()
  }

  componentDidUpdate = () => {
    const { visible, clickX, clickY } = this.props.contextMenuInfo

    if (!visible || !this.root) {
      return this.removeListeners()
    }

    this.addListeners()

    const rootW = this.root.offsetWidth
    const rootH = this.root.offsetHeight
    const screenW = window.innerWidth
    const screenH = window.innerHeight

    const right = (screenW - clickX) > rootW
    const left = !right
    const top = (screenH - clickY) > rootH
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
    }
  }

  render = () => {
    const { visible, id, data } = this.props.contextMenuInfo

    if (!visible) {
      return null
    }

    const getContextMenuComponent = (id) => {
      switch (id) {
        case 'roster': return RosterContextMenu
      }
    }

    const ContextMenuComponent = getContextMenuComponent(id)

    return (
      <div ref={ref => { this.root = ref }} className='context__menu'>
        <ContextMenuComponent data={data} />
      </div>
    )
  }
}
