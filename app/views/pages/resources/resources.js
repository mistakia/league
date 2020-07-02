/* global fetch */
import React from 'react'
import marked from 'marked'

import { DOCS_URL } from '@core/constants'
import PageLayout from '@layouts/page'

import './resources.styl'

export default class ResourcesPage extends React.Component {
  constructor (props) {
    super(props)

    this.state = { html: null }
  }

  componentDidMount = () => {
    fetch(`${DOCS_URL}/resources.md`)
      .then((response) => {
        if (response.status >= 200 && response.status < 300) {
          return response
        } else {
          const html = (
            <div className='resources'>Failed to Load</div>
          )
          this.setState({ html })
          const error = new Error(response.statusText)
          error.response = response
          throw error
        }
      })
      .then(res => res.json())
      .then(json => {
        const content = window.atob(json.content)
        const renderer = new marked.Renderer()
        const linkRenderer = renderer.link
        renderer.link = (href, title, text) => {
          const html = linkRenderer.call(renderer, href, title, text)
          return html.replace(/^<a /, '<a target="_blank" rel="nofollow" ')
        }
        const markdown = marked(content, { renderer })
        const html = (
          <div className='resources' dangerouslySetInnerHTML={{ __html: markdown }} />
        )
        this.setState({ html })
      }).catch((error) => {
        console.log(error)
      })
  }

  render = () => {
    return (
      <PageLayout body={this.state.html} scroll />
    )
  }
}
