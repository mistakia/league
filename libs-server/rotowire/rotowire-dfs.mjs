import debug from 'debug'

import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'

const api_log = debug('rotowire:dfs:api')

// RotoWire's public daily-fantasy JSON, used for ONE job: recovering FanDuel
// salaries for weeks our own importer missed.
//
// FanDuel expires its fixture lists, so a missed FanDuel week is gone from the
// vendor permanently — unlike DraftKings, whose draft groups stay addressable
// forever. RotoWire keeps historical slates indefinitely and is the only free
// source found that still carries FanDuel salaries after 2021 (RotoGuru, and
// every dataset derived from it, stops at 2021 week 18).
//
// Two endpoints, no auth:
//   players.php       — salary, team, opponent, game datetime, position
//   player-csv-data.php — the id crosswalk, including SiteSlateID
//
// The crosswalk is what makes this trustworthy rather than a guess. RotoWire's
// own `slateID` is site-agnostic and carries no site label, but `SiteSlateID` is
// the operator's OWN slate id — and for FanDuel that is exactly the fixture-list
// id we already store in `player_salaries.source_contest_id`. So slates are
// identified by joining on an operator id, not by inferring a site from salary
// shape.
//
// Validated 2026-08-31 against a week we already held: RotoWire slate 7150
// carries SiteSlateID 107594, which we imported live in 2024 REG week 5, and all
// 109 comparable players agreed on salary EXACTLY with zero disagreements.
const ROTOWIRE_DFS_API = 'https://www.rotowire.com/daily/nfl/api'

// Not our own service, so it goes over the proxy pool like any other vendor.
// The shared `default` pool is the right tier here: RotoWire is not known to
// block us, and the residential addresses are a scarce shared resource reserved
// for vendors that do. See
// [[user:guideline/software/vendor-egress-proxy-posture.md]].
const rotowire_fetch = async ({ url }) => {
  api_log(`ROTOWIRE REQUEST: ${url}`)
  return fetch_with_retry({
    url,
    use_proxy: true,
    response_type: 'json',
    max_retries: 2,
    initial_delay: 1000,
    max_delay: 10000
  })
}

// Salary rows for a slate. Returns [] for a slate id that does not exist rather
// than throwing, since discovery walks ids speculatively.
export const get_rotowire_slate_players = async ({ slate_id }) => {
  const data = await rotowire_fetch({
    url: `${ROTOWIRE_DFS_API}/players.php?slateID=${slate_id}`
  })
  return Array.isArray(data) ? data : []
}

// The id crosswalk for a slate. `SiteSlateID` is the operator's slate id.
export const get_rotowire_slate_crosswalk = async ({ slate_id }) => {
  const data = await rotowire_fetch({
    url: `${ROTOWIRE_DFS_API}/player-csv-data.php?slateID=${slate_id}`
  })
  return Array.isArray(data?.players) ? data.players : []
}

// Which operator a slate belongs to, read off the crosswalk's id SHAPES.
//
// `SitePlayerID === PlayerContestID` alone is NOT sufficient for FanDuel, and
// trusting it admits other operators wholesale. Measured 2026-08-31 on the 2024
// week 13 range, where it accepted two impostors:
//   slate 7752 — SiteSlateID 22319, 10-digit player ids, "salaries" of 1.00-2.45
//                (a fractional-multiplier pick'em product, not salary cap)
//   slate 7753 — SiteSlateID 6423016598667264, 10-digit player ids
// Both would have been written as FANDUEL rows. A wrong-operator row is worse
// than a missing one: it is populated, plausible, and invisible to any
// fill-rate check.
//
// The discriminator is id WIDTH, taken from our own data rather than inferred.
// All 241 FanDuel fixture-list ids in `player_salaries` are exactly six digits
// (105733-125313), so the SLATE id carries the identification.
//
// The PLAYER id does not: FanDuel player ids run four to six digits (slate 7748
// splits 239/558/5 across widths 6/5/4), so requiring six there rejects every
// real slate. An earlier version did exactly that and turned a working filter
// into one that accepted nothing — caught only because the test asserted on
// known-good slates as well as on the impostors. What player ids DO give is an
// upper bound: the impostors' are ten digits.
const FANDUEL_SLATE_ID_PATTERN = /^\d{6}$/
const FANDUEL_PLAYER_ID_PATTERN = /^\d{1,6}$/
const YAHOO_PLAYER_ID_PATTERN = /^nfl\.p\./

// Returns null when the crosswalk is empty or the shapes do not agree, which is
// the honest answer for "this slate is not confidently FanDuel" and keeps an
// ambiguous slate out of the import entirely.
export const identify_rotowire_slate_operator = (crosswalk) => {
  if (!crosswalk.length) return null

  const site_slate_ids = new Set(
    crosswalk.map((row) => row.SiteSlateID).filter(Boolean)
  )
  if (site_slate_ids.size !== 1) return null

  const site_slate_id = String([...site_slate_ids][0])

  const yahoo_shaped = crosswalk.filter((row) =>
    YAHOO_PLAYER_ID_PATTERN.test(String(row.SitePlayerID || ''))
  ).length
  if (yahoo_shaped > crosswalk.length / 2) {
    return { operator: 'YAHOO', site_slate_id }
  }

  // A clear majority, not a bare one: a handful of coincidental equalities
  // should not carry a slate.
  const MAJORITY = crosswalk.length * 0.9

  if (FANDUEL_SLATE_ID_PATTERN.test(site_slate_id)) {
    const fanduel_shaped = crosswalk.filter(
      (row) =>
        row.SitePlayerID &&
        row.PlayerContestID &&
        String(row.SitePlayerID) === String(row.PlayerContestID) &&
        FANDUEL_PLAYER_ID_PATTERN.test(String(row.SitePlayerID))
    ).length
    if (fanduel_shaped > MAJORITY) {
      return { operator: 'FANDUEL', site_slate_id }
    }
  }

  const draftkings_shaped = crosswalk.filter(
    (row) =>
      row.SitePlayerID &&
      row.PlayerContestID &&
      String(row.SitePlayerID) !== String(row.PlayerContestID)
  ).length
  if (draftkings_shaped > MAJORITY) {
    return { operator: 'DRAFTKINGS', site_slate_id }
  }

  return null
}

// A salary-cap slate carries whole-dollar salaries in the thousands. A product
// whose "salary" is a fractional multiplier (1.00, 2.45) is a pick'em contest
// wearing the same field name, and its numbers must never reach player_salaries.
const MIN_PLAUSIBLE_SALARY = 1000

export const has_salary_cap_shape = (players) => {
  const salaries = players.map((player) => player.salary).filter(Boolean)
  if (!salaries.length) return false
  return salaries.every(
    (salary) => Number.isInteger(salary) && salary >= MIN_PLAUSIBLE_SALARY
  )
}

// A slate's identity and contents in one call pair, or null when it is not a
// confidently-identified slate for the requested operator.
export const get_rotowire_slate = async ({ slate_id, operator }) => {
  const crosswalk = await get_rotowire_slate_crosswalk({ slate_id })
  const identity = identify_rotowire_slate_operator(crosswalk)
  if (!identity || identity.operator !== operator) return null

  const players = await get_rotowire_slate_players({ slate_id })
  if (!players.length) return null

  // Second, independent gate. The id shapes say who OWNS the slate; this says
  // whether it is a salary-cap contest at all.
  if (!has_salary_cap_shape(players)) return null

  return {
    slate_id,
    operator: identity.operator,
    site_slate_id: identity.site_slate_id,
    players
  }
}
