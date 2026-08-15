import fs from 'fs'
import path from 'path'

import { get_page_meta } from '#libs-server/page-meta.mjs'
import { clear_placeholders, render_template } from '#libs-shared/page-meta.mjs'

// The SPA fallback. Every non-asset path gets the SAME built bundle, but the
// `<head>` is filled per route before the response goes out — a crawler never
// runs the app, so anything the SPA sets at runtime is invisible to it. This is
// the only place a shared league link acquires a title and a preview card.
//
// The template is the webpack build output, which carries `{{PLACEHOLDER}}`
// tokens authored in app/index.html. They are deliberately not filled at build
// time: one bundle serves every route.

export const create_render_html_middleware = ({ dist_path, origin }) => {
  const template_path = path.join(dist_path, 'index.html')

  let cached_template = null

  const load_template = () => {
    if (cached_template) return cached_template
    cached_template = fs.readFileSync(template_path, 'utf8')
    return cached_template
  }

  const send_html = (res, html) => {
    res.set('Cache-Control', 'public, max-age=0, must-revalidate')
    res.set('Content-Type', 'text/html; charset=utf-8')
    return res.send(html)
  }

  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    let template
    try {
      template = load_template()
    } catch (error) {
      // No bundle on disk. This is what a deploy that never shipped `dist`
      // looks like, and a 404 is the honest answer — the same one the previous
      // sendFile handler gave.
      return res.status(404).send('Page not found')
    }

    try {
      const meta_data = await get_page_meta({
        url_path: req.originalUrl || req.path,
        origin
      })
      return send_html(res, render_template(template, meta_data))
    } catch (error) {
      // Metadata is never worth a failed page load. Serve the page with an
      // empty head and let the SPA fill it on mount.
      return send_html(res, clear_placeholders(template))
    }
  }
}
