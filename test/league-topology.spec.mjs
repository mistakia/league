/* global describe it beforeEach afterEach */

import fs from 'fs'
import os from 'os'
import path from 'path'
import * as chai from 'chai'

import {
  league_topology,
  league_topology_path,
  reset_league_topology_cache,
  resolve_user_base_directory
} from '#libs-server/league-topology.mjs'

const { expect } = chai

// These tests exist because the whole point of the change they cover is a
// NEGATIVE: this repository is public, so the fleet's hostnames, container
// names and storage paths must not be literals here -- not even as an
// env-overridable default, which publishes them just the same. A default that
// silently works on the author's machine is exactly the regression to catch,
// and only the absence path catches it.

const write_topology = (contents) => {
  const file = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'league-topology-')),
    'topology.json'
  )
  fs.writeFileSync(file, JSON.stringify(contents))
  return file
}

const generation = {
  host: 'a-host',
  container: 'a-container',
  container_user: 'a-user',
  transcript_dir: '/a/transcript/dir',
  metrics_url: 'localhost:1234/metrics'
}

const backup = {
  host: 'a-storage-host',
  dev_fixture_path: '/a/dev/fixtures',
  full_dump_path: '/a/full/dumps',
  local_path: '/a/local/backups'
}

const complete = { generation, backup }

describe('league topology', function () {
  const original_file = process.env.LEAGUE_TOPOLOGY_FILE
  const original_user_base = process.env.USER_BASE_DIRECTORY

  beforeEach(() => reset_league_topology_cache())

  afterEach(() => {
    reset_league_topology_cache()
    if (original_file === undefined) {
      delete process.env.LEAGUE_TOPOLOGY_FILE
    } else {
      process.env.LEAGUE_TOPOLOGY_FILE = original_file
    }
    if (original_user_base === undefined) {
      delete process.env.USER_BASE_DIRECTORY
    } else {
      process.env.USER_BASE_DIRECTORY = original_user_base
    }
  })

  it('carries no topology value at rest, because this repository is public', () => {
    // The two consumers and the loader together. Field NAMES are generic and
    // may appear; no value for any of them may.
    const sources = [
      '../libs-server/league-topology.mjs',
      '../scripts/data-view-benchmark-run.mjs',
      '../scripts/restore-backup.mjs'
    ].map((relative) =>
      fs.readFileSync(new URL(relative, import.meta.url), 'utf8')
    )

    for (const source of sources) {
      expect(source).to.not.match(/base-storage/)
      expect(source).to.not.match(/\/home\/node\//)
      expect(source).to.not.match(/base-user-league/)
      expect(source).to.not.match(/\/storage\/backups/)
    }
  })

  it('resolves the file from the user base without naming an operator home', () => {
    delete process.env.LEAGUE_TOPOLOGY_FILE
    process.env.USER_BASE_DIRECTORY = '/somewhere/user-base'
    expect(league_topology_path()).to.equal(
      '/somewhere/user-base/config/league-topology.json'
    )

    delete process.env.USER_BASE_DIRECTORY
    expect(resolve_user_base_directory()).to.equal(
      path.join(os.homedir(), 'user-base')
    )
  })

  it('fails LOUD and by name when the file is absent, rather than defaulting', () => {
    process.env.LEAGUE_TOPOLOGY_FILE = path.join(
      os.tmpdir(),
      'no-such-league-topology.json'
    )
    expect(() => league_topology('generation')).to.throw(
      /league topology file not found at .*no-such-league-topology\.json/
    )
    expect(() => league_topology('backup')).to.throw(
      /league topology file not found/
    )
  })

  it('names the SECTION it is missing', () => {
    process.env.LEAGUE_TOPOLOGY_FILE = write_topology({ generation })
    expect(() => league_topology('backup')).to.throw(
      /has no "backup" section; it must carry host, dev_fixture_path/
    )
  })

  it('names every field it is missing, qualified by section', () => {
    process.env.LEAGUE_TOPOLOGY_FILE = write_topology({
      generation: { host: 'a-host', container: 'a-container' },
      backup
    })
    expect(() => league_topology('generation')).to.throw(
      /is missing generation\.container_user, generation\.transcript_dir, generation\.metrics_url/
    )
  })

  it('refuses an unknown section rather than reading it as absent config', () => {
    process.env.LEAGUE_TOPOLOGY_FILE = write_topology(complete)
    expect(() => league_topology('generatoin')).to.throw(
      /unknown league topology section "generatoin"; known sections are generation, backup/
    )
  })

  it('refuses a MALFORMED file rather than treating it as absent', () => {
    const file = write_topology(complete)
    fs.writeFileSync(file, '{ not json')
    process.env.LEAGUE_TOPOLOGY_FILE = file
    expect(() => league_topology('generation')).to.throw(/is not valid JSON/)
  })

  it('returns every field of each section when the file is complete', () => {
    process.env.LEAGUE_TOPOLOGY_FILE = write_topology(complete)
    expect(league_topology('generation')).to.deep.equal(generation)
    expect(league_topology('backup')).to.deep.equal(backup)
  })

  it('validates only the section asked for', () => {
    // A host that runs restores needs no generation values, and the reverse.
    process.env.LEAGUE_TOPOLOGY_FILE = write_topology({
      generation,
      backup: { host: 'a-storage-host' }
    })
    expect(league_topology('generation')).to.deep.equal(generation)
    expect(() => league_topology('backup')).to.throw(/is missing backup\./)
  })

  it('does not throw at IMPORT, so a caller needing none of it still loads', async () => {
    // scripts/data-view-benchmark-ground-truth.mjs imports the runner for
    // `check_correctness` alone, which touches no host and no container. A
    // module-scope resolve would break it wherever the file is absent.
    process.env.LEAGUE_TOPOLOGY_FILE = path.join(
      os.tmpdir(),
      'no-such-league-topology.json'
    )
    const { check_correctness } =
      await import('../scripts/data-view-benchmark-run.mjs')
    expect(check_correctness).to.be.a('function')
  })
})
