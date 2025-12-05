/* global describe it */

import * as chai from 'chai'

import {
  format_standard_selection_id,
  parse_standard_selection_id
} from '#libs-shared'

chai.should()
const expect = chai.expect

describe('LIBS-SHARED format_standard_selection_id', function () {
  describe('game events (ESBID)', function () {
    it('player game prop with over/under', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_PASSING_YARDS',
        pid: 'JARE-GOFF-2016-1994-10-14',
        selection_type: 'OVER',
        line: 249.5
      })
      expect(result).to.equal(
        'ESBID:2024111011|MARKET:GAME_PASSING_YARDS|PID:JARE-GOFF-2016-1994-10-14|SEL:OVER|LINE:249.5'
      )
    })

    it('player game prop with under', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_PASSING_YARDS',
        pid: 'JARE-GOFF-2016-1994-10-14',
        selection_type: 'UNDER',
        line: 249.5
      })
      expect(result).to.equal(
        'ESBID:2024111011|MARKET:GAME_PASSING_YARDS|PID:JARE-GOFF-2016-1994-10-14|SEL:UNDER|LINE:249.5'
      )
    })

    it('team spread with negative line', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_SPREAD',
        team: 'DET',
        line: -3.5
      })
      expect(result).to.equal(
        'ESBID:2024111011|MARKET:GAME_SPREAD|TEAM:DET|LINE:-3.5'
      )
    })

    it('team moneyline (no line)', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_MONEYLINE',
        team: 'DET'
      })
      expect(result).to.equal('ESBID:2024111011|MARKET:GAME_MONEYLINE|TEAM:DET')
    })

    it('game total over/under', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_TOTAL',
        selection_type: 'OVER',
        line: 48.5
      })
      expect(result).to.equal(
        'ESBID:2024111011|MARKET:GAME_TOTAL|SEL:OVER|LINE:48.5'
      )
    })

    it('game overtime (binary YES/NO)', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'GAME_OVERTIME',
        selection_type: 'YES'
      })
      expect(result).to.equal('ESBID:2024111011|MARKET:GAME_OVERTIME|SEL:YES')
    })

    it('anytime touchdown (achievement)', () => {
      const result = format_standard_selection_id({
        esbid: '2024111011',
        market_type: 'ANYTIME_TOUCHDOWN',
        pid: 'TYRE-HILL-2016-1994-03-01',
        selection_type: 'YES'
      })
      expect(result).to.equal(
        'ESBID:2024111011|MARKET:ANYTIME_TOUCHDOWN|PID:TYRE-HILL-2016-1994-03-01|SEL:YES'
      )
    })
  })

  describe('season events', function () {
    it('regular season player prop', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'REG',
        market_type: 'SEASON_PASSING_YARDS',
        pid: 'PATR-MAHO-2017-1995-09-17',
        selection_type: 'OVER',
        line: 4500.5
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:REG|MARKET:SEASON_PASSING_YARDS|PID:PATR-MAHO-2017-1995-09-17|SEL:OVER|LINE:4500.5'
      )
    })

    it('team regular season wins', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'REG',
        market_type: 'TEAM_REGULAR_SEASON_WINS',
        team: 'DET',
        selection_type: 'OVER',
        line: 10.5
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:REG|MARKET:TEAM_REGULAR_SEASON_WINS|TEAM:DET|SEL:OVER|LINE:10.5'
      )
    })

    it('super bowl winner (futures)', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'REG',
        market_type: 'SUPER_BOWL_WINNER',
        team: 'KC'
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:REG|MARKET:SUPER_BOWL_WINNER|TEAM:KC'
      )
    })

    it('season MVP', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'REG',
        market_type: 'SEASON_MVP',
        pid: 'LAMA-JACK-2018-1997-01-07'
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:REG|MARKET:SEASON_MVP|PID:LAMA-JACK-2018-1997-01-07'
      )
    })

    it('season leader passing yards', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'REG',
        market_type: 'SEASON_LEADER_PASSING_YARDS',
        pid: 'PATR-MAHO-2017-1995-09-17'
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:REG|MARKET:SEASON_LEADER_PASSING_YARDS|PID:PATR-MAHO-2017-1995-09-17'
      )
    })
  })

  describe('playoff events', function () {
    it('playoff passing yards', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'POST',
        market_type: 'PLAYOFF_PASSING_YARDS',
        pid: 'PATR-MAHO-2017-1995-09-17',
        selection_type: 'OVER',
        line: 800.5
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:POST|MARKET:PLAYOFF_PASSING_YARDS|PID:PATR-MAHO-2017-1995-09-17|SEL:OVER|LINE:800.5'
      )
    })

    it('playoff rushing yards under', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'POST',
        market_type: 'PLAYOFF_RUSHING_YARDS',
        pid: 'DERI-HENR-2016-1994-01-04',
        selection_type: 'UNDER',
        line: 400.5
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:POST|MARKET:PLAYOFF_RUSHING_YARDS|PID:DERI-HENR-2016-1994-01-04|SEL:UNDER|LINE:400.5'
      )
    })
  })

  describe('week events', function () {
    it('week leader passing yards', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'REG',
        week: 12,
        market_type: 'GAME_LEADER_PASSING_YARDS',
        pid: 'JARE-GOFF-2016-1994-10-14'
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:REG|WEEK:12|MARKET:GAME_LEADER_PASSING_YARDS|PID:JARE-GOFF-2016-1994-10-14'
      )
    })
  })

  describe('day events', function () {
    it('sunday leader passing yards', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'REG',
        week: 12,
        day: 'SUN',
        market_type: 'SUNDAY_LEADER_PASSING_YARDS',
        pid: 'JARE-GOFF-2016-1994-10-14'
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:REG|WEEK:12|DAY:SUN|MARKET:SUNDAY_LEADER_PASSING_YARDS|PID:JARE-GOFF-2016-1994-10-14'
      )
    })

    it('sunday leader rushing yards', () => {
      const result = format_standard_selection_id({
        year: 2024,
        seas_type: 'REG',
        week: 12,
        day: 'SUN',
        market_type: 'SUNDAY_LEADER_RUSHING_YARDS',
        pid: 'DERI-HENR-2016-1994-01-04'
      })
      expect(result).to.equal(
        'SEAS:2024|SEAS_TYPE:REG|WEEK:12|DAY:SUN|MARKET:SUNDAY_LEADER_RUSHING_YARDS|PID:DERI-HENR-2016-1994-01-04'
      )
    })
  })

  describe('validation', function () {
    it('throws error for missing market_type', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011'
        })
      ).to.throw('market_type is required')
    })

    it('throws error for invalid market_type', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011',
          market_type: 'INVALID_TYPE'
        })
      ).to.throw('Invalid market_type: INVALID_TYPE')
    })

    it('throws error for missing event identifier', () => {
      expect(() =>
        format_standard_selection_id({
          market_type: 'GAME_PASSING_YARDS'
        })
      ).to.throw('Either esbid or year must be provided')
    })

    it('throws error for both esbid and year', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011',
          year: 2024,
          market_type: 'GAME_PASSING_YARDS'
        })
      ).to.throw('Cannot provide both esbid and year')
    })

    it('throws error for invalid selection_type', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011',
          market_type: 'GAME_PASSING_YARDS',
          selection_type: 'INVALID'
        })
      ).to.throw('Invalid selection_type')
    })

    it('throws error for invalid seas_type', () => {
      expect(() =>
        format_standard_selection_id({
          year: 2024,
          seas_type: 'INVALID',
          market_type: 'SEASON_PASSING_YARDS'
        })
      ).to.throw('Invalid seas_type')
    })

    it('throws error for invalid day', () => {
      expect(() =>
        format_standard_selection_id({
          year: 2024,
          week: 12,
          day: 'INVALID',
          market_type: 'SUNDAY_LEADER_PASSING_YARDS'
        })
      ).to.throw('Invalid day')
    })

    it('throws error for reserved characters in esbid', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024|111011',
          market_type: 'GAME_PASSING_YARDS'
        })
      ).to.throw("esbid cannot contain reserved characters '|' or ':'")
    })

    it('throws error for reserved characters in pid', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011',
          market_type: 'GAME_PASSING_YARDS',
          pid: 'PLAYER:ID'
        })
      ).to.throw("pid cannot contain reserved characters '|' or ':'")
    })

    it('throws error for invalid team abbreviation', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011',
          market_type: 'GAME_MONEYLINE',
          team: 'INVALID'
        })
      ).to.throw('Invalid team abbreviation: INVALID')
    })

    it('throws error for historical team code (PHO)', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011',
          market_type: 'GAME_MONEYLINE',
          team: 'PHO'
        })
      ).to.throw('Invalid team abbreviation: PHO')
    })

    it('throws error for team name instead of abbreviation', () => {
      expect(() =>
        format_standard_selection_id({
          esbid: '2024111011',
          market_type: 'GAME_MONEYLINE',
          team: 'Lions'
        })
      ).to.throw('Invalid team abbreviation: Lions')
    })

    it('accepts all valid NFL team abbreviations', () => {
      const valid_teams = [
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
      ]

      valid_teams.forEach((team) => {
        const result = format_standard_selection_id({
          esbid: '2024111011',
          market_type: 'GAME_MONEYLINE',
          team
        })
        expect(result).to.include(`TEAM:${team}`)
      })
    })
  })
})

describe('LIBS-SHARED parse_standard_selection_id', function () {
  describe('game events', function () {
    it('parses player game prop', () => {
      const result = parse_standard_selection_id(
        'ESBID:2024111011|MARKET:GAME_PASSING_YARDS|PID:JARE-GOFF-2016-1994-10-14|SEL:OVER|LINE:249.5'
      )
      expect(result.esbid).to.equal('2024111011')
      expect(result.market_type).to.equal('GAME_PASSING_YARDS')
      expect(result.pid).to.equal('JARE-GOFF-2016-1994-10-14')
      expect(result.selection_type).to.equal('OVER')
      expect(result.line).to.equal(249.5)
      expect(result.event_type).to.equal('game')
    })

    it('parses team spread', () => {
      const result = parse_standard_selection_id(
        'ESBID:2024111011|MARKET:GAME_SPREAD|TEAM:DET|LINE:-3.5'
      )
      expect(result.esbid).to.equal('2024111011')
      expect(result.market_type).to.equal('GAME_SPREAD')
      expect(result.team).to.equal('DET')
      expect(result.line).to.equal(-3.5)
      expect(result.event_type).to.equal('game')
    })

    it('parses team moneyline', () => {
      const result = parse_standard_selection_id(
        'ESBID:2024111011|MARKET:GAME_MONEYLINE|TEAM:DET'
      )
      expect(result.esbid).to.equal('2024111011')
      expect(result.market_type).to.equal('GAME_MONEYLINE')
      expect(result.team).to.equal('DET')
      expect(result.event_type).to.equal('game')
    })
  })

  describe('season events', function () {
    it('parses regular season player prop', () => {
      const result = parse_standard_selection_id(
        'SEAS:2024|SEAS_TYPE:REG|MARKET:SEASON_PASSING_YARDS|PID:PATR-MAHO-2017-1995-09-17|SEL:OVER|LINE:4500.5'
      )
      expect(result.year).to.equal(2024)
      expect(result.seas_type).to.equal('REG')
      expect(result.market_type).to.equal('SEASON_PASSING_YARDS')
      expect(result.pid).to.equal('PATR-MAHO-2017-1995-09-17')
      expect(result.selection_type).to.equal('OVER')
      expect(result.line).to.equal(4500.5)
      expect(result.event_type).to.equal('season')
    })

    it('parses playoff event', () => {
      const result = parse_standard_selection_id(
        'SEAS:2024|SEAS_TYPE:POST|MARKET:PLAYOFF_PASSING_YARDS|PID:PATR-MAHO-2017-1995-09-17|SEL:OVER|LINE:800.5'
      )
      expect(result.year).to.equal(2024)
      expect(result.seas_type).to.equal('POST')
      expect(result.market_type).to.equal('PLAYOFF_PASSING_YARDS')
      expect(result.event_type).to.equal('season')
    })
  })

  describe('week events', function () {
    it('parses week leader market', () => {
      const result = parse_standard_selection_id(
        'SEAS:2024|SEAS_TYPE:REG|WEEK:12|MARKET:GAME_LEADER_PASSING_YARDS|PID:JARE-GOFF-2016-1994-10-14'
      )
      expect(result.year).to.equal(2024)
      expect(result.seas_type).to.equal('REG')
      expect(result.week).to.equal(12)
      expect(result.market_type).to.equal('GAME_LEADER_PASSING_YARDS')
      expect(result.pid).to.equal('JARE-GOFF-2016-1994-10-14')
      expect(result.event_type).to.equal('week')
    })
  })

  describe('day events', function () {
    it('parses sunday leader market', () => {
      const result = parse_standard_selection_id(
        'SEAS:2024|SEAS_TYPE:REG|WEEK:12|DAY:SUN|MARKET:SUNDAY_LEADER_PASSING_YARDS|PID:JARE-GOFF-2016-1994-10-14'
      )
      expect(result.year).to.equal(2024)
      expect(result.seas_type).to.equal('REG')
      expect(result.week).to.equal(12)
      expect(result.day).to.equal('SUN')
      expect(result.market_type).to.equal('SUNDAY_LEADER_PASSING_YARDS')
      expect(result.pid).to.equal('JARE-GOFF-2016-1994-10-14')
      expect(result.event_type).to.equal('day')
    })
  })

  describe('roundtrip', function () {
    it('format then parse returns same data (game event)', () => {
      const original = {
        esbid: '2024111011',
        market_type: 'GAME_PASSING_YARDS',
        pid: 'JARE-GOFF-2016-1994-10-14',
        selection_type: 'OVER',
        line: 249.5
      }
      const formatted = format_standard_selection_id(original)
      const parsed = parse_standard_selection_id(formatted)

      expect(parsed.esbid).to.equal(original.esbid)
      expect(parsed.market_type).to.equal(original.market_type)
      expect(parsed.pid).to.equal(original.pid)
      expect(parsed.selection_type).to.equal(original.selection_type)
      expect(parsed.line).to.equal(original.line)
    })

    it('format then parse returns same data (season event)', () => {
      const original = {
        year: 2024,
        seas_type: 'REG',
        market_type: 'SEASON_PASSING_YARDS',
        pid: 'PATR-MAHO-2017-1995-09-17',
        selection_type: 'OVER',
        line: 4500.5
      }
      const formatted = format_standard_selection_id(original)
      const parsed = parse_standard_selection_id(formatted)

      expect(parsed.year).to.equal(original.year)
      expect(parsed.seas_type).to.equal(original.seas_type)
      expect(parsed.market_type).to.equal(original.market_type)
      expect(parsed.pid).to.equal(original.pid)
      expect(parsed.selection_type).to.equal(original.selection_type)
      expect(parsed.line).to.equal(original.line)
    })
  })

  describe('validation', function () {
    it('throws error for empty string', () => {
      expect(() => parse_standard_selection_id('')).to.throw(
        'selection_id must be a non-empty string'
      )
    })

    it('throws error for null', () => {
      expect(() => parse_standard_selection_id(null)).to.throw(
        'selection_id must be a non-empty string'
      )
    })

    it('throws error for missing MARKET field', () => {
      expect(() => parse_standard_selection_id('ESBID:2024111011')).to.throw(
        'Selection ID must contain MARKET field'
      )
    })

    it('throws error for missing event identifier', () => {
      expect(() =>
        parse_standard_selection_id('MARKET:GAME_PASSING_YARDS')
      ).to.throw('Selection ID must contain either ESBID or SEAS field')
    })

    it('throws error for invalid key-value pair', () => {
      expect(() =>
        parse_standard_selection_id('ESBID2024111011|MARKET:GAME_PASSING_YARDS')
      ).to.throw('Invalid key-value pair')
    })

    it('throws error for unknown key', () => {
      expect(() =>
        parse_standard_selection_id(
          'ESBID:2024111011|MARKET:GAME_PASSING_YARDS|UNKNOWN:value'
        )
      ).to.throw('Unknown key in selection ID: UNKNOWN')
    })
  })
})
