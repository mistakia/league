/* global describe it beforeEach afterEach */

import fs from 'fs'
import os from 'os'
import path from 'path'
import * as chai from 'chai'

import {
  generation_topology,
  generation_topology_path,
  reset_generation_topology_cache,
  resolve_user_base_directory
} from '#libs-server/data-views/generation/generation-topology.mjs'

const { expect } = chai

// These tests exist because the whole point of the change they cover is a
// NEGATIVE: this repository is public, so the generation host, tenant
// container and in-container transcript path must not be literals here -- not
// even as an env-overridable default, which publishes them just the same. A
// default that silently works on the author's machine is exactly the
// regression to catch, and only the absence path catches it.

const write_topology = (contents) => {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'generation-topology-')),
    'topology.json'
  )
  fs.writeFileSync(file, JSON.stringify(contents))
  return file
}

const complete_topology = {
  host: 'a-host',
  container: 'a-container',
  container_user: 'a-user',
  transcript_dir: '/a/transcript/dir',
  metrics_url: 'localhost:1234/metrics'
}

describe('data views generation topology', function () {
  const original_file = process.env.LEAGUE_GENERATION_TOPOLOGY_FILE
  const original_user_base = process.env.USER_BASE_DIRECTORY

  beforeEach(() => reset_generation_topology_cache())

  afterEach(() => {
    reset_generation_topology_cache()
    if (original_file === undefined) {
      delete process.env.LEAGUE_GENERATION_TOPOLOGY_FILE
    } else {
      process.env.LEAGUE_GENERATION_TOPOLOGY_FILE = original_file
    }
    if (original_user_base === undefined) {
      delete process.env.USER_BASE_DIRECTORY
    } else {
      process.env.USER_BASE_DIRECTORY = original_user_base
    }
  })

  it('carries no topology value at rest, because this repository is public', () => {
    const source = fs.readFileSync(
      new URL(
        '../libs-server/data-views/generation/generation-topology.mjs',
        import.meta.url
      ),
      'utf8'
    )
    // The module may name the FIELDS -- those are generic -- but must hold no
    // value for any of them.
    expect(source).to.not.match(/base-storage/)
    expect(source).to.not.match(/\/home\/node\//)
    expect(source).to.not.match(/base-user-league/)
  })

  it('resolves the file from the user base without naming an operator home', () => {
    delete process.env.LEAGUE_GENERATION_TOPOLOGY_FILE
    process.env.USER_BASE_DIRECTORY = '/somewhere/user-base'
    expect(generation_topology_path()).to.equal(
      '/somewhere/user-base/config/league-generation-topology.json'
    )

    delete process.env.USER_BASE_DIRECTORY
    expect(resolve_user_base_directory()).to.equal(
      path.join(os.homedir(), 'user-base')
    )
  })

  it('fails LOUD and by name when the file is absent, rather than defaulting', () => {
    process.env.LEAGUE_GENERATION_TOPOLOGY_FILE = path.join(
      os.tmpdir(),
      'no-such-generation-topology.json'
    )
    expect(() => generation_topology()).to.throw(
      /generation topology file not found at .*no-such-generation-topology\.json/
    )
  })

  it('names every field it is missing', () => {
    process.env.LEAGUE_GENERATION_TOPOLOGY_FILE = write_topology({
      host: 'a-host',
      container: 'a-container'
    })
    expect(() => generation_topology()).to.throw(
      /is missing container_user, transcript_dir, metrics_url/
    )
  })

  it('refuses a MALFORMED file rather than treating it as absent', () => {
    const file = write_topology(complete_topology)
    fs.writeFileSync(file, '{ not json')
    process.env.LEAGUE_GENERATION_TOPOLOGY_FILE = file
    expect(() => generation_topology()).to.throw(/is not valid JSON/)
  })

  it('returns every field when the file is complete', () => {
    process.env.LEAGUE_GENERATION_TOPOLOGY_FILE =
      write_topology(complete_topology)
    expect(generation_topology()).to.deep.equal(complete_topology)
  })

  it('does not throw at IMPORT, so a caller needing none of it still loads', async () => {
    // scripts/data-view-benchmark-ground-truth.mjs imports the runner for
    // `check_correctness` alone, which touches no host and no container. A
    // module-scope resolve would break it wherever the file is absent.
    process.env.LEAGUE_GENERATION_TOPOLOGY_FILE = path.join(
      os.tmpdir(),
      'no-such-generation-topology.json'
    )
    const { check_correctness } =
      await import('../scripts/data-view-benchmark-run.mjs')
    expect(check_correctness).to.be.a('function')
  })
})
