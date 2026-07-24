/* global fetch */
import React from 'react'
import PropTypes from 'prop-types'
import { marked } from 'marked'

import { DOCS_URL, README_URL } from '@core/constants'
import PageLayout from '@layouts/page'

import './markdown.styl'

// Docs are entity-managed and may carry a YAML frontmatter block. marked has no
// frontmatter support, so an unstripped block renders as a wall of body text at
// the top of the page.
const strip_frontmatter = (content) =>
  content.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/, '')

// Per-document class so a single doc can be styled without leaking into the
// others: '/README.md' -> 'about', '/guides/data-views.md' -> 'guides-data-views'
const page_modifier = (path) =>
  path === '/README.md'
    ? 'about'
    : path.replace(/^\//, '').replace(/\.md$/, '').replace(/\//g, '-')

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
        // GitHub returns base64; atob yields a Latin-1 binary string, so decode
        // the bytes as UTF-8 to preserve em dashes and smart quotes.
        const binary = window.atob(json.content)
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
        const content = strip_frontmatter(
          new TextDecoder('utf-8').decode(bytes)
        )
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
        const html = (
          <div
            className={`markdown markdown__${page_modifier(this.props.path)}`}
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
