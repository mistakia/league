/* global describe it */
import * as chai from 'chai'

import {
  resolve_play_stat_player,
  decode_smart_player_id,
  play_stat_name_matches_player
} from '#libs-server/resolve-play-stat-player.mjs'
import { group_play_stats_by_pid } from '../scripts/generate-player-gamelogs.mjs'

const expect = chai.expect

// Build the `smart_player_id` shape the legacy import path wrote: a 36-char
// dashed UUID with a gsis id hex-embedded at the offset `decode_id` reads.
// 10,483 of the 10,897 player rows carrying one encode that row's OWN gsis id,
// which is why the column carries no independent identity information.
const encode_smart_player_id = (gsis_player_id) => {
  const hex = [...gsis_player_id]
    .map((character) => character.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
  const dashless = `3201${hex}27ec3138`
  return [
    dashless.substring(0, 8),
    dashless.substring(8, 12),
    dashless.substring(12, 16),
    dashless.substring(16, 20),
    dashless.substring(20, 32)
  ].join('-')
}

const build_player = ({
  pid,
  formatted_name,
  primary_position,
  nfl_draft_year,
  gsis_player_id,
  smart_player_id
}) => ({
  pid,
  formatted_name,
  primary_position,
  nfl_draft_year,
  gsis_player_id,
  smart_player_id
})

const build_indexes = (players) => ({
  players_by_smart_player_id: new Map(
    players.filter((p) => p.smart_player_id).map((p) => [p.smart_player_id, p])
  ),
  players_by_gsis_player_id: new Map(
    players.filter((p) => p.gsis_player_id).map((p) => [p.gsis_player_id, p])
  )
})

describe('LIBS SERVER resolve_play_stat_player', function () {
  describe('decode_smart_player_id', function () {
    it('recovers the gsis id embedded in a real production value', () => {
      expect(
        decode_smart_player_id('32013030-2d30-3031-3937-313027ec3138')
      ).to.equal('00-0019710')
    })

    it('round-trips the encoder used by these fixtures', () => {
      expect(
        decode_smart_player_id(encode_smart_player_id('00-0027452'))
      ).to.equal('00-0027452')
    })

    it('returns null for a value that is not a 36-character uuid', () => {
      expect(decode_smart_player_id('00-0019710')).to.equal(null)
      expect(decode_smart_player_id(null)).to.equal(null)
    })

    it('returns null when the decoded bytes are not a gsis id', () => {
      // A genuine vendor smart id decodes to an Elias-style name abbreviation,
      // not to a gsis id -- it must not be mistaken for a fabricated one.
      expect(
        decode_smart_player_id('32014d41-4e50-3031-3233-343527ec3138')
      ).to.equal(null)
    })
  })

  describe('play_stat_name_matches_player', function () {
    const player = build_player({
      pid: 'PEYT-MANN-000001',
      formatted_name: 'peyton manning'
    })

    it('survives the feed formatting variance recorded as making this column unreliable', () => {
      for (const player_name of [
        'P.Manning',
        'P. Manning',
        'Peyton Manning',
        'PeytonManning'
      ]) {
        expect(
          play_stat_name_matches_player({ player_name, player }),
          player_name
        ).to.equal(true)
      }
    })

    it('strips a generational suffix the player row does not carry', () => {
      expect(
        play_stat_name_matches_player({
          player_name: 'K.Cole Sr.',
          player: build_player({
            pid: 'KEEL-COLE-000002',
            formatted_name: 'keelan cole'
          })
        })
      ).to.equal(true)
    })

    it('rejects a different player', () => {
      expect(
        play_stat_name_matches_player({ player_name: 'T.Brady', player })
      ).to.equal(false)
    })
  })

  describe('resolution tiers', function () {
    it('resolves a row carrying only a gsis id -- the rows this script dropped', () => {
      const adams = build_player({
        pid: 'DAVA-ADAM-000003',
        formatted_name: 'davante adams',
        gsis_player_id: '00-0031381',
        smart_player_id: encode_smart_player_id('00-0031381')
      })
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: '00-0031381',
          smart_player_id: null,
          player_name: 'D.Adams',
          stat_id: 106
        },
        ...build_indexes([adams]),
        season_year: 2016
      })
      expect(result).to.eql({ pid: 'DAVA-ADAM-000003', tier: 'gsis_only' })
    })

    it('treats a smart id that resolves to nothing as absent, not as evidence', () => {
      const poteat = build_player({
        pid: 'HENR-POTE-012550',
        formatted_name: 'henry poteat',
        gsis_player_id: '00-0019710',
        smart_player_id: null
      })
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: '00-0019710',
          smart_player_id: '32013030-2d30-3031-3937-313027ec3138',
          player_name: 'H.Poteat',
          stat_id: 106
        },
        ...build_indexes([poteat]),
        season_year: 2002
      })
      expect(result).to.eql({ pid: 'HENR-POTE-012550', tier: 'gsis_only' })
    })

    it('returns the agreed pid when both identifiers name one player', () => {
      const adams = build_player({
        pid: 'DAVA-ADAM-000003',
        formatted_name: 'davante adams',
        gsis_player_id: '00-0031381',
        smart_player_id: encode_smart_player_id('00-0031381')
      })
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: '00-0031381',
          smart_player_id: encode_smart_player_id('00-0031381'),
          player_name: 'D.Adams',
          stat_id: 21
        },
        ...build_indexes([adams]),
        season_year: 2016
      })
      expect(result).to.eql({ pid: 'DAVA-ADAM-000003', tier: 'agreed' })
    })

    it('resolves structurally when the smart id decodes to the row own gsis id', () => {
      // The row agrees with itself; the smart-side player row is the one holding
      // a foreign encoding. This is 3,585 of the 5,224 conflicting rows.
      const stolen = encode_smart_player_id('00-0027452')
      const jarrett = build_player({
        pid: 'JARR-BROW-021298',
        formatted_name: 'jarrett brown',
        primary_position: 'QB',
        nfl_draft_year: 2010,
        gsis_player_id: '00-0027452'
      })
      const james = build_player({
        pid: 'JAME-BROW-012500',
        formatted_name: 'james brown',
        primary_position: 'T',
        nfl_draft_year: 1992,
        gsis_player_id: '00-0004001',
        smart_player_id: stolen
      })
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: '00-0027452',
          smart_player_id: stolen,
          player_name: 'J.Brown',
          stat_id: 14
        },
        ...build_indexes([jarrett, james]),
        season_year: 2011
      })
      expect(result).to.eql({ pid: 'JARR-BROW-021298', tier: 'decoded_self' })
    })

    it('falls to the feed name when the row carries two conflicting gsis ids', () => {
      const white = build_player({
        pid: 'STEV-WHIT-011060',
        formatted_name: 'steve white',
        primary_position: 'DL',
        nfl_draft_year: 1996,
        gsis_player_id: '00-0005001',
        smart_player_id: encode_smart_player_id('00-0005001')
      })
      const abraham = build_player({
        pid: 'JOHN-ABRA-025246',
        formatted_name: 'john abraham',
        primary_position: 'LB',
        nfl_draft_year: 2000,
        gsis_player_id: '00-0020270'
      })
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: '00-0020270',
          smart_player_id: encode_smart_player_id('00-0005001'),
          player_name: 'J.Abraham',
          stat_id: 79
        },
        ...build_indexes([white, abraham]),
        season_year: 2003
      })
      expect(result).to.eql({ pid: 'JOHN-ABRA-025246', tier: 'name' })
    })

    it('picks the smart side when the feed name names it', () => {
      const wallace = build_player({
        pid: 'SENE-WALL-009563',
        formatted_name: 'seneca wallace',
        primary_position: 'QB',
        nfl_draft_year: 2003,
        gsis_player_id: '00-0006001',
        smart_player_id: encode_smart_player_id('00-0006001')
      })
      const garrett = build_player({
        pid: 'KEVI-GARR-025033',
        formatted_name: 'kevin garrett',
        primary_position: 'DB',
        nfl_draft_year: 2003,
        gsis_player_id: '00-0021900'
      })
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: '00-0021900',
          smart_player_id: encode_smart_player_id('00-0006001'),
          player_name: 'S.Wallace',
          stat_id: 79
        },
        ...build_indexes([wallace, garrett]),
        season_year: 2003
      })
      expect(result).to.eql({ pid: 'SENE-WALL-009563', tier: 'name' })
    })

    it('breaks a shared surname and initial on who had entered the league', () => {
      const sterling = build_player({
        pid: 'STER-WEAT-025072',
        formatted_name: 'sterling weatherford',
        primary_position: 'LB',
        nfl_draft_year: 2022,
        gsis_player_id: '00-0007001',
        smart_player_id: encode_smart_player_id('00-0007001')
      })
      const steve = build_player({
        pid: 'STEV-WEAT-023907',
        formatted_name: 'steve weatherford',
        primary_position: 'K',
        nfl_draft_year: 2006,
        gsis_player_id: '00-0024226'
      })
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: '00-0024226',
          smart_player_id: encode_smart_player_id('00-0007001'),
          player_name: 'S.Weatherford',
          stat_id: 29
        },
        ...build_indexes([sterling, steve]),
        season_year: 2010
      })
      expect(result).to.eql({ pid: 'STEV-WEAT-023907', tier: 'era' })
    })

    it('breaks a remaining tie on whether the position can record the stat', () => {
      // Both entered the league before 2011 and share "J.Brown", so only the
      // stat itself separates them: a tackle throws no passes.
      const james = build_player({
        pid: 'JAME-BROW-012500',
        formatted_name: 'james brown',
        primary_position: 'T',
        nfl_draft_year: 1992,
        gsis_player_id: '00-0004001',
        smart_player_id: encode_smart_player_id('00-0004001')
      })
      const jarrett = build_player({
        pid: 'JARR-BROW-021298',
        formatted_name: 'jarrett brown',
        primary_position: 'QB',
        nfl_draft_year: 2010,
        gsis_player_id: '00-0027452'
      })
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: '00-0027452',
          smart_player_id: encode_smart_player_id('00-0004001'),
          player_name: 'J.Brown',
          stat_id: 14
        },
        ...build_indexes([james, jarrett]),
        season_year: 2011
      })
      expect(result).to.eql({ pid: 'JARR-BROW-021298', tier: 'position' })
    })

    it('abstains rather than guessing when no tier separates the two', () => {
      const robert = build_player({
        pid: 'ROBE-WILL-010659',
        formatted_name: 'robert williams',
        primary_position: 'DB',
        nfl_draft_year: 1998,
        gsis_player_id: '00-0008001',
        smart_player_id: encode_smart_player_id('00-0008001')
      })
      const rodney = build_player({
        pid: 'RODN-WILL-010730',
        formatted_name: 'rodney williams',
        primary_position: 'P',
        nfl_draft_year: 1999,
        gsis_player_id: '00-0009001'
      })
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: '00-0009001',
          smart_player_id: encode_smart_player_id('00-0008001'),
          player_name: 'R.Williams',
          stat_id: 79
        },
        ...build_indexes([robert, rodney]),
        season_year: 2005
      })
      expect(result).to.equal(null)
    })

    it('returns null when neither identifier names a player', () => {
      const result = resolve_play_stat_player({
        play_stat: {
          gsis_player_id: null,
          smart_player_id: null,
          player_name: null,
          stat_id: 79
        },
        ...build_indexes([]),
        season_year: 2005
      })
      expect(result).to.equal(null)
    })
  })

  describe('group_play_stats_by_pid', function () {
    it('merges a gsis-only row into the group the same player already has', () => {
      // The regression this change fixes. The second row names Adams by gsis id
      // alone; because he was already seen via his smart id, the old second pass
      // skipped its whole group and the fumble was never counted.
      const adams = build_player({
        pid: 'DAVA-ADAM-000003',
        formatted_name: 'davante adams',
        primary_position: 'WR',
        nfl_draft_year: 2014,
        gsis_player_id: '00-0031381',
        smart_player_id: encode_smart_player_id('00-0031381')
      })
      const playStats = [
        {
          gsis_player_id: '00-0031381',
          smart_player_id: encode_smart_player_id('00-0031381'),
          player_name: 'D.Adams',
          stat_id: 21,
          year: 2016
        },
        {
          gsis_player_id: '00-0031381',
          smart_player_id: null,
          player_name: 'D.Adams',
          stat_id: 106,
          year: 2016
        }
      ]

      const grouped = group_play_stats_by_pid({
        playStats,
        ...build_indexes([adams])
      })

      expect(grouped.size).to.equal(1)
      expect(grouped.get('DAVA-ADAM-000003')).to.have.length(2)
    })

    it('drops a row it cannot resolve rather than attributing it to anyone', () => {
      const grouped = group_play_stats_by_pid({
        playStats: [
          {
            gsis_player_id: '00-0099999',
            smart_player_id: null,
            player_name: 'X.Nobody',
            stat_id: 79,
            year: 2016
          }
        ],
        ...build_indexes([])
      })

      expect(grouped.size).to.equal(0)
    })
  })
})
