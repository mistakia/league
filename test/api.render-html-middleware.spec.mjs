/* global describe before after it */
import * as chai from 'chai'
import express from 'express'
import { createServer } from 'http'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { create_render_html_middleware } from '#libs-server/middleware/render-html.mjs'

const expect = chai.expect

const template_for = (bundle) =>
  `<!doctype html><html><head><title>{{PAGE_TITLE}}</title>` +
  `<meta name="robots" content="{{META_ROBOTS}}">` +
  `<script src="/dist/${bundle}"></script></head><body></body></html>`

describe('API render-html middleware', function () {
  let server
  let dist_path
  let base_url

  before(async function () {
    dist_path = fs.mkdtempSync(path.join(os.tmpdir(), 'render-html-'))
    fs.writeFileSync(
      path.join(dist_path, 'index.html'),
      template_for('main.AAA.js')
    )

    const app = express()
    app.use(
      '/*',
      create_render_html_middleware({
        dist_path,
        origin: 'https://xo.football'
      })
    )
    server = createServer(app)
    await new Promise((resolve) => server.listen(0, resolve))
    base_url = `http://127.0.0.1:${server.address().port}`
  })

  after(function () {
    if (server) server.close()
    if (dist_path) fs.rmSync(dist_path, { recursive: true, force: true })
  })

  const get = async (url_path) => {
    const response = await fetch(`${base_url}${url_path}`)
    return response.text()
  }

  it('fills the placeholders for the route', async function () {
    const html = await get('/plays')
    expect(html).to.include('<title>Plays - xo.football</title>')
    expect(html).to.include('content="index, follow"')
    expect(html).to.not.match(/\{\{[A-Z_]+\}\}/)
  })

  it('marks an unrecognized path noindex', async function () {
    expect(await get('/not-a-route')).to.include('content="noindex, nofollow"')
  })

  // The regression that shipped on 2026-08-14. `yarn deploy:all` reloads pm2
  // BEFORE it rsyncs `dist`, so a middleware that caches the template on first
  // read serves the PREVIOUS build's HTML for the life of the process — and
  // since bundles are content-hashed and the old file is deleted, that HTML
  // points at an asset the `/dist` mount (fallthrough: false) answers 404 for.
  it('re-reads the template after the bundle is replaced on disk', async function () {
    expect(await get('/plays')).to.include('main.AAA.js')

    // mtime has one-second resolution on some filesystems, so move it
    // explicitly rather than relying on the write landing in a new second.
    const template_path = path.join(dist_path, 'index.html')
    fs.writeFileSync(template_path, template_for('main.BBB.js'))
    const future = new Date(Date.now() + 2000)
    fs.utimesSync(template_path, future, future)

    const html = await get('/plays')
    expect(html).to.include('main.BBB.js')
    expect(html).to.not.include('main.AAA.js')
  })

  it('404s rather than serving a partial page when no bundle exists', async function () {
    const empty_dist = fs.mkdtempSync(
      path.join(os.tmpdir(), 'render-html-empty-')
    )
    const app = express()
    app.use(
      '/*',
      create_render_html_middleware({
        dist_path: empty_dist,
        origin: 'https://xo.football'
      })
    )
    const empty_server = createServer(app)
    await new Promise((resolve) => empty_server.listen(0, resolve))

    const response = await fetch(
      `http://127.0.0.1:${empty_server.address().port}/plays`
    )
    expect(response.status).to.equal(404)

    empty_server.close()
    fs.rmSync(empty_dist, { recursive: true, force: true })
  })
})
