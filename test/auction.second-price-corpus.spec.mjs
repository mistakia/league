/* global describe, it, before */

import fs from 'fs'
import path from 'path'

import * as chai from 'chai'

import { auction_election_outcomes } from '#constants'
import { resolve_auction_player } from '#libs-server/resolve-auction-player.mjs'

const expect = chai.expect

// THE PRICING GATE. This corpus is every auction win in league 1 from 2021
// through 2025, replayed against the resolver. It is deliberately a SEPARATE
// gate from test/auction.slow-mode-tail-corpus.spec.mjs, which covers the
// completeness and settlement claim, so that a failure says which of the two
// claims broke rather than "the auction corpus is red".
//
// The expected winner and price in the fixture were computed in SQL against the
// live database, independently of the resolver -- the fixture carries that query
// in `expectations_sql`. A divergence here is therefore an engine bug, not a new
// finding.

const corpus = JSON.parse(
  fs.readFileSync(
    path.join(
      process.cwd(),
      'test/fixtures/auction-second-price-replay-2021-2025.json'
    ),
    'utf8'
  )
)

// The corpus is evidence about PRICE, so nothing else may bind. Every team is
// given room, position eligibility, and a cap comfortably above the largest
// maximum anywhere in the corpus -- if a roster term ever decided one of these
// players, the result would be evidence about eligibility instead and the
// comparison against the historical price would be meaningless.
const UNBOUNDED_CAP = 1000

const rosters_for = (claims) => {
  const rosters = new Map()
  for (const claim of claims) {
    rosters.set(claim.tid, {
      available_space: 99,
      available_cap: UNBOUNDED_CAP,
      is_eligible_for_slot: true
    })
  }
  return rosters
}

const name_of = (player) => `${player.season_year} ${player.pid}`

const replay = (player) =>
  resolve_auction_player({
    claims: player.claims,
    rosters: rosters_for(player.claims),
    nominating_team_id: player.nominating_team_id,
    opening_bid: player.opening_bid
  })

describe('auction second-price corpus (2021-2025)', function () {
  let results

  before(function () {
    // Every maximum in the corpus must sit below the cap, or the cap is silently
    // deciding players and this whole file is measuring the wrong thing.
    const largest = Math.max(
      ...corpus.players.flatMap((player) =>
        player.claims.map((claim) => claim.maximum_bid)
      )
    )
    expect(largest).to.be.below(
      UNBOUNDED_CAP,
      'a maximum in the corpus reaches the cap, so the cap is binding and the replay no longer measures price alone'
    )

    results = corpus.players.map((player) => ({
      player,
      resolved: replay(player)
    }))
  })

  it('carries the corpus the summary describes', function () {
    expect(corpus.players).to.have.lengthOf(corpus.summary.players)
    expect(corpus.summary.players).to.equal(300)
  })

  it('reproduces the independently computed winner for every player', function () {
    // Named divergences, not a count. A bare "292 !== 300" tells whoever broke
    // the resolver nothing about which rule they broke.
    const divergences = results
      .filter(({ player, resolved }) => {
        return resolved.winner_tid !== player.expected_winner_tid
      })
      .map(
        ({ player, resolved }) =>
          `${name_of(player)}: expected team ${player.expected_winner_tid}, resolved team ${resolved.winner_tid}`
      )

    expect(divergences, divergences.join('\n')).to.be.empty
  })

  it('reproduces the independently computed price for every player', function () {
    const divergences = results
      .filter(
        ({ player, resolved }) => resolved.price !== player.expected_price
      )
      .map(
        ({ player, resolved }) =>
          `${name_of(player)}: expected $${player.expected_price}, resolved $${resolved.price}` +
          ` (claims ${player.claims.map((claim) => `${claim.tid}@$${claim.maximum_bid}`).join(', ')}` +
          `, opened at $${player.opening_bid} by team ${player.nominating_team_id})`
      )

    expect(divergences, divergences.join('\n')).to.be.empty
  })

  it('awards exactly one won outcome per player', function () {
    const divergences = results
      .filter(({ resolved }) => {
        const won = [...resolved.outcomes.values()].filter(
          (entry) => entry.outcome === auction_election_outcomes.WON
        )
        return won.length !== 1
      })
      .map(({ player }) => name_of(player))

    expect(divergences, divergences.join('\n')).to.be.empty
  })

  it('never prices a player above the winner stated maximum', function () {
    const divergences = results
      .filter(({ player, resolved }) => {
        const winning_claim = player.claims.find(
          (claim) => claim.tid === resolved.winner_tid
        )
        return resolved.price > winning_claim.maximum_bid
      })
      .map(({ player, resolved }) => `${name_of(player)} at $${resolved.price}`)

    expect(divergences, divergences.join('\n')).to.be.empty
  })

  it('never prices a player below the opening bid', function () {
    const divergences = results
      .filter(({ player, resolved }) => resolved.price < player.opening_bid)
      .map(
        ({ player, resolved }) =>
          `${name_of(player)}: $${resolved.price} below an opening bid of $${player.opening_bid}`
      )

    expect(divergences, divergences.join('\n')).to.be.empty
  })

  // The headline of the replay, and the number the league will be shown when a
  // manager questions second price. It is one-directional by construction: the
  // second price is the runner-up's ceiling plus a dollar, which can only be at
  // or below what an ascending auction charged.
  it('is cheaper than the live auction on eight players and dearer on none', function () {
    let identical = 0
    let cheaper = 0
    const dearer = []

    for (const { player, resolved } of results) {
      if (resolved.price === player.actual_price) identical++
      else if (resolved.price < player.actual_price) cheaper++
      else
        dearer.push(
          `${name_of(player)}: $${resolved.price} vs $${player.actual_price}`
        )
    }

    expect(dearer, dearer.join('\n')).to.be.empty
    expect(identical).to.equal(corpus.summary.identical)
    expect(cheaper).to.equal(corpus.summary.cheaper)
  })

  it('changes no winner against the live auction', function () {
    const changed = results
      .filter(
        ({ player, resolved }) =>
          resolved.winner_tid !== player.actual_winner_tid
      )
      .map(
        ({ player, resolved }) =>
          `${name_of(player)}: team ${resolved.winner_tid} instead of team ${player.actual_winner_tid}`
      )

    expect(changed, changed.join('\n')).to.be.empty
    expect(corpus.summary.winner_changes).to.equal(0)
  })

  it('moves total spend by the measured amount', function () {
    const second_price_dollars = results.reduce(
      (total, { resolved }) => total + resolved.price,
      0
    )
    const actual_dollars = corpus.players.reduce(
      (total, player) => total + player.actual_price,
      0
    )

    expect(actual_dollars).to.equal(corpus.summary.actual_dollars)
    expect(second_price_dollars).to.equal(corpus.summary.second_price_dollars)
    expect(second_price_dollars - actual_dollars).to.equal(corpus.summary.delta)
  })
})
