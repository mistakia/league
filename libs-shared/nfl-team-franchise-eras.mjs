/*
  The current franchise abbreviation is canonical for every NFL team column in
  this database. Historical rows do not all carry it: nfl_games stores the ERA
  abbreviation a franchise used at the time -- SD for the Chargers through 2016,
  STL for the Rams 1995-2015, RAI and RAM for the Anaheim/Los Angeles years --
  and several external feeds supply the same era tokens.

  fixTeam cannot do this job and is not to be changed. It is a pure function of
  the token with no season parameter, so it answers "which franchise is this
  token most likely to mean today" rather than "which franchise was this token
  in that season". Those two questions have DIFFERENT answers for three tokens,
  and that is the whole reason this module exists:

    STL  Cardinals 1960-1987, then Rams 1995-2015
    BAL  Colts 1953-1983, then Ravens 1996-
    HOU  Oilers 1960-1996, then Texans 2002-

  BAL and HOU are the sharp cases, because each is ALSO a canonical abbreviation
  in its own right. A 1975 Colts row reads as already-canonical to any check
  that looks only at the token, so a token census cannot serve as a completeness
  oracle and any resolver that answers "canonical returns itself" BEFORE
  consulting the season silently no-ops every one of those rows. Resolution here
  is season-first for exactly that reason -- see resolve_canonical_nfl_team.
*/

export const canonical_nfl_teams = Object.freeze([
  'ARI',
  'ATL',
  'BAL',
  'BUF',
  'CAR',
  'CHI',
  'CIN',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GB',
  'HOU',
  'IND',
  'JAX',
  'KC',
  'LA',
  'LAC',
  'LV',
  'MIA',
  'MIN',
  'NE',
  'NO',
  'NYG',
  'NYJ',
  'PHI',
  'PIT',
  'SEA',
  'SF',
  'TB',
  'TEN',
  'WAS'
])

/*
  Tokens that occupy an nfl_team column without naming a franchise. They pass
  through unchanged rather than throwing, and they are the named exception to
  the canonical-abbreviation convention.

  INA is fixTeam's "no team" sentinel. AFC and NFC are the Pro Bowl conference
  sides. IRV, RIC, SAN and CRT are the captain-squad Pro Bowls of 2013-2015,
  where the game was played between two drafted squads named for their captains
  rather than between the conferences.
*/
export const non_franchise_nfl_teams = Object.freeze([
  'INA',
  'AFC',
  'NFC',
  'IRV',
  'RIC',
  'SAN',
  'CRT'
])

/*
  Vendor SPELLINGS of a franchise that is not in question. These are NOT eras:
  the token names one franchise across its whole history, so no season is
  needed to resolve it, and that is exactly why they are a separate map rather
  than unbounded rows in the era table below -- putting them there would say a
  franchise changed abbreviation when nothing changed but a feed's spelling.

  Every one is season-independent and unambiguous: none is canonical, and none
  is an era token of any other franchise. fixTeam already collapses all five to
  the same targets, so this map agrees with the resolution the rest of the
  codebase performs.

  Found by sweeping every team column in production for tokens in neither the
  canonical set nor the era table (2026-09-02): ARZ/BLT/CLV/HST appear on 239
  nfl_play_stats rows in 2020-2021, and LAR on one player.draft_team row for
  1994. Nothing else in the database is unaccounted for except four
  EMPTY-STRING slots, which are deliberately not mapped here -- an empty team is
  an absence wearing a value, a different defect with a different repair, and
  quietly resolving it to a franchise would hide it.
*/
export const nfl_team_spelling_aliases = Object.freeze({
  ARZ: 'ARI',
  BLT: 'BAL',
  CLV: 'CLE',
  HST: 'HOU',
  LAR: 'LA'
})

/*
  Every (token, season range) pair whose canonical franchise is not the token
  itself, plus -- deliberately -- the ranges where it IS. The BAL and HOU
  identity ranges are not redundant: they are what make the range lookup answer
  those tokens from the SEASON in the years each franchise actually existed,
  rather than falling back to a token-only answer for a franchise whose token is
  ambiguous by season.

  That is NOT the same as being total, and an earlier revision of this comment
  claimed it was. Both tokens have a GAP -- BAL 1984-1995, between the Colts
  leaving and the Ravens arriving, and HOU 1997-2001 between the Oilers and the
  Texans -- and a row dated inside a gap falls through to the canonical-identity
  case and resolves to itself. No correct row can exist there, since no
  franchise held the token in those years, so this is not reachable by good
  data; a MIS-DATED row (a 1983 Colts game stored as 1984) resolves silently
  rather than raising. Filling the gaps with explicit ranges is not obviously
  right either -- there is no correct canonical answer for a season in which
  nobody used the token -- so the behaviour is recorded here rather than
  changed.

  end_year null means the era is current. Ranges are inclusive on both ends and
  are drawn from franchise history, not from the row counts that happen to be
  stored today, so a row landing outside the observed range still resolves.
*/
export const nfl_team_franchise_eras = Object.freeze([
  // Cardinals: Chicago, St. Louis, Phoenix, Arizona
  Object.freeze({
    era_nfl_team: 'STL',
    start_year: 1960,
    end_year: 1987,
    canonical_nfl_team: 'ARI'
  }),
  Object.freeze({
    era_nfl_team: 'PHO',
    start_year: 1988,
    end_year: 1993,
    canonical_nfl_team: 'ARI'
  }),

  // Colts: Baltimore, then Indianapolis. BAL is reused by the Ravens from 1996.
  Object.freeze({
    era_nfl_team: 'BAL',
    start_year: 1953,
    end_year: 1983,
    canonical_nfl_team: 'IND'
  }),
  Object.freeze({
    era_nfl_team: 'BAL',
    start_year: 1996,
    end_year: null,
    canonical_nfl_team: 'BAL'
  }),

  // Oilers: Houston, then Tennessee. HOU is reused by the Texans from 2002.
  Object.freeze({
    era_nfl_team: 'HOU',
    start_year: 1960,
    end_year: 1996,
    canonical_nfl_team: 'TEN'
  }),
  Object.freeze({
    era_nfl_team: 'HOU',
    start_year: 2002,
    end_year: null,
    canonical_nfl_team: 'HOU'
  }),

  /*
    Rams: Los Angeles, Anaheim, St. Louis, Los Angeles again.

    RAM is UNBOUNDED because it is not season-ambiguous -- it has only ever
    named this franchise, so the answer is LA in every year. It was originally
    bounded 1980-1994, which anchored it on the move to Anaheim Stadium: a
    change of stadium, not of name or abbreviation. That made resolve throw on a
    1975 RAM row and on any modern one, and the throw is the failure mode a
    bound like this actually produces -- a token narrower than its real usage
    cannot mis-write a row, it just refuses to resolve one it should have.
  */
  Object.freeze({
    era_nfl_team: 'RAM',
    start_year: 1946,
    end_year: null,
    canonical_nfl_team: 'LA'
  }),
  Object.freeze({
    era_nfl_team: 'STL',
    start_year: 1995,
    end_year: 2015,
    canonical_nfl_team: 'LA'
  }),

  // Chargers: San Diego through 2016, Los Angeles from 2017.
  Object.freeze({
    era_nfl_team: 'SD',
    start_year: 1961,
    end_year: 2016,
    canonical_nfl_team: 'LAC'
  }),

  /*
    Raiders. nfl_games already stores LV for every Oakland-era game, so OAK
    appears zero times in that table -- but the nflverse feed supplies OAK, and
    RAI is stored for the Los Angeles years, so both need an entry.
  */
  Object.freeze({
    era_nfl_team: 'RAI',
    start_year: 1960,
    end_year: null,
    canonical_nfl_team: 'LV'
  }),
  Object.freeze({
    era_nfl_team: 'OAK',
    start_year: 1960,
    end_year: null,
    canonical_nfl_team: 'LV'
  }),

  // Patriots: Boston through 1970, New England from 1971.
  Object.freeze({
    era_nfl_team: 'BOS',
    start_year: 1960,
    end_year: 1970,
    canonical_nfl_team: 'NE'
  })
])

const canonical_nfl_team_set = new Set(canonical_nfl_teams)
const non_franchise_nfl_team_set = new Set(non_franchise_nfl_teams)

const find_franchise_era = ({ era_nfl_team, season_year }) =>
  nfl_team_franchise_eras.find(
    (era) =>
      era.era_nfl_team === era_nfl_team &&
      season_year >= era.start_year &&
      (era.end_year === null || season_year <= era.end_year)
  )

export const is_canonical_nfl_team = (nfl_team) =>
  canonical_nfl_team_set.has(nfl_team)

export const is_non_franchise_nfl_team = (nfl_team) =>
  non_franchise_nfl_team_set.has(nfl_team)

/*
  Resolve an era abbreviation to the franchise's CURRENT abbreviation.

  The lookup order is load-bearing and is the one thing about this function to
  preserve if it is ever rewritten:

    1. a (token, season_year) range match wins, even when the token is itself
       canonical -- this is what makes ('BAL', 1975) return IND rather than BAL;
    2. only then does a canonical token with no matching range return itself;
    3. a vendor SPELLING alias resolves to its franchise. It sits after the two
       cases above and cannot shadow either, because no alias is canonical and
       no alias is an era token -- so its position is safe rather than merely
       untested;
    4. the non-franchise tokens pass through;
    5. anything else throws, so an unmodelled token is loud rather than written
       through unchanged.

  Putting case 2 first would be a silent no-op on every Colts and Oilers row --
  they are canonical-looking by token and wrong by season -- and would also make
  any completeness oracle built on this function vacuous, since the oracle asks
  it the same question. The two failures are one bug.
*/
export const resolve_canonical_nfl_team = ({ era_nfl_team, season_year }) => {
  if (!era_nfl_team) {
    throw new Error(`resolve_canonical_nfl_team: missing era_nfl_team`)
  }

  /*
    Number() is NOT a usable guard here and reading it as one is the bug this
    shape exists to prevent: Number(null), Number('') and Number([]) are all 0,
    and 0 is an integer, so a bare `Number.isInteger(Number(season_year))`
    ACCEPTS every one of them and resolves at year 0. Year 0 matches no era
    range, so the token falls through to the canonical-identity case and a
    ('BAL', null) row resolves to BAL -- silently answering the Ravens for a row
    whose season nobody knows, which is precisely the collision this module
    exists to get right. Only `undefined` threw.

    So the type is checked BEFORE any coercion, and a numeric string is admitted
    explicitly rather than by accident. season_year is nullable on nfl_games,
    which is where such a row would come from.
  */
  const year =
    typeof season_year === 'number'
      ? season_year
      : typeof season_year === 'string' && season_year.trim() !== ''
        ? Number(season_year)
        : NaN

  if (!Number.isInteger(year)) {
    throw new Error(
      `resolve_canonical_nfl_team: invalid season_year (${JSON.stringify(season_year)}) for ${era_nfl_team}`
    )
  }

  const era = find_franchise_era({ era_nfl_team, season_year: year })
  if (era) {
    return era.canonical_nfl_team
  }

  if (is_canonical_nfl_team(era_nfl_team)) {
    return era_nfl_team
  }

  const alias = nfl_team_spelling_aliases[era_nfl_team]
  if (alias) {
    return alias
  }

  if (is_non_franchise_nfl_team(era_nfl_team)) {
    return era_nfl_team
  }

  throw new Error(
    `resolve_canonical_nfl_team: unknown nfl_team ${era_nfl_team} for season ${year}`
  )
}
