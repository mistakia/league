/* global fetch */
import React from 'react'
import PropTypes from 'prop-types'
import { marked } from 'marked'

import { DOCS_URL, README_URL } from '@core/constants'
import PageLayout from '@layouts/page'
import { get_string_from_object } from '@libs-shared'

import './markdown.styl'

export default class MarkdownPage extends React.Component {
  constructor(props) {
    super(props)

    this.state = { html: null }
  }

  _load() {
    const url =
      this.props.path === '/README.md'
        ? README_URL
        : `${DOCS_URL}${this.props.path}`
    fetch(url)
      .then((response) => {
        if (response.status >= 200 && response.status < 300) {
          return response
        } else {
          const html = <div className='markdown'>Failed to Load</div>
          this.setState({ html })
          const error = new Error(response.statusText)
          error.response = response
          throw error
        }
      })
      .then((res) => res.json())
      .then((json) => {
        const content = window.atob(json.content)
        const renderer = new marked.Renderer()
        const linkRenderer = renderer.link

        renderer.link = (href, title, text) => {
          const html = linkRenderer.call(renderer, href, title, text)
          if (!href.startsWith('#')) {
            return html.replace(/^<a /, '<a target="_blank" rel="nofollow" ')
          }
          return html
        }
        const markdown = marked(content, { renderer })
        const className = get_string_from_object({
          markdown: true,
          'max-width-1150': this.props.path === '/resources'
        })
        const html = (
          <div
            className={className}
            dangerouslySetInnerHTML={{ __html: markdown }}
          />
        )
        this.setState({ html })
      })
      .catch((error) => {
        console.log(error)
      })
  }

  componentDidUpdate = (prevProps) => {
    if (prevProps.path === this.props.path) return

    this._load()
  }

  componentDidMount = () => {
    this._load()
  }

  render = () => {
    return <PageLayout body={this.state.html} scroll />
  }
}

MarkdownPage.propTypes = {
  path: PropTypes.string
}
