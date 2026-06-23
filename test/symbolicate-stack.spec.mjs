/* global describe, it, before, after */

import os from 'os'
import path from 'path'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'

import * as chai from 'chai'
import { SourceMapGenerator } from 'source-map'

import { symbolicate_stack } from '#libs-server/symbolicate-stack.mjs'

const expect = chai.expect

describe('symbolicate_stack', function () {
  let sourcemap_dir

  before(function () {
    sourcemap_dir = mkdtempSync(path.join(os.tmpdir(), 'league-maps-'))
    const generator = new SourceMapGenerator({ file: 'bundle.abc123.js' })
    generator.addMapping({
      generated: { line: 1, column: 100 },
      original: { line: 42, column: 5 },
      source: 'webpack:///app/views/components/error-test/error-test.js',
      name: 'crash_on_render'
    })
    writeFileSync(
      path.join(sourcemap_dir, 'bundle.abc123.js.map'),
      generator.toString()
    )
  })

  after(function () {
    rmSync(sourcemap_dir, { recursive: true, force: true })
  })

  it('resolves a minified frame to its original file:line:column', async function () {
    const stack = [
      'Error: boom',
      '    at A (https://xo.football/dist/bundle.abc123.js:1:100)'
    ].join('\n')
    const result = await symbolicate_stack(stack, { sourcemap_dir })
    expect(result).to.include(
      'app/views/components/error-test/error-test.js:42:5'
    )
    expect(result).to.not.include('bundle.abc123.js:1:100')
  })

  it('rewrites the minified function name with the original symbol', async function () {
    const stack = '    at A (https://xo.football/dist/bundle.abc123.js:1:100)'
    const result = await symbolicate_stack(stack, { sourcemap_dir })
    expect(result).to.include('at crash_on_render (')
  })

  it('leaves frames without a matching sourcemap untouched', async function () {
    const stack = '    at b (https://xo.football/dist/vendor.999.js:1:50)'
    const result = await symbolicate_stack(stack, { sourcemap_dir })
    expect(result).to.equal(stack)
  })

  it('returns the original stack when the sourcemap dir is missing', async function () {
    const stack = '    at A (https://xo.football/dist/bundle.abc123.js:1:100)'
    const result = await symbolicate_stack(stack, {
      sourcemap_dir: '/nonexistent/sourcemaps'
    })
    expect(result).to.equal(stack)
  })

  it('passes through non-string and empty input unchanged', async function () {
    expect(await symbolicate_stack(null, { sourcemap_dir })).to.equal(null)
    expect(await symbolicate_stack('', { sourcemap_dir })).to.equal('')
  })
})
