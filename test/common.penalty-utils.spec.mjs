/* global describe it */

import * as chai from 'chai'

import { penalty_utils } from '#libs-shared'

chai.should()
const expect = chai.expect

const {
  extract_penalty_from_desc,
  normalize_penalty_type,
  get_canonical_penalty_type,
  PENALTY_TYPE_CANONICAL_MAP,
  SIDE_SPECIFIC_PENALTIES
} = penalty_utils

describe('LIBS-SHARED penalty_utils', function () {
  describe('extract_penalty_from_desc', function () {
    it('extracts penalty with player name format', () => {
      const desc =
        '(12:12) (Shotgun) J.Herbert pass incomplete. PENALTY on CAR-J.Clowney, Illegal Use of Hands, 5 yards, enforced at CAR 45 - No Play.'
      expect(extract_penalty_from_desc({ desc })).to.equal(
        'Illegal Use of Hands'
      )
    })

    it('extracts penalty with team-only format', () => {
      const desc =
        '(11:55) (Shotgun) PENALTY on NYJ, Delay of Game, 5 yards, enforced at NE 40 - No Play.'
      expect(extract_penalty_from_desc({ desc })).to.equal('Delay of Game')
    })

    it('extracts first penalty when multiple penalties in description', () => {
      const desc =
        '(12:58) J.Goff pass incomplete. PENALTY on TEN-J.Brownlee, Defensive Pass Interference, 5 yards, enforced at TEN 21 - No Play. PENALTY on TEN-J.Brownlee, Face Mask, 8 yards, enforced between downs.'
      expect(extract_penalty_from_desc({ desc })).to.equal(
        'Defensive Pass Interference'
      )
    })

    it('handles 4-character team codes', () => {
      const desc =
        'Z.Evans left end to LAR 20 for 2 yards. PENALTY on LARC-D.Leonard, Horse Collar Tackle, 15 yards, enforced at LAR 20.'
      expect(extract_penalty_from_desc({ desc })).to.equal(
        'Horse Collar Tackle'
      )
    })

    it('returns null for null/undefined desc', () => {
      expect(extract_penalty_from_desc({ desc: null })).to.equal(null)
      expect(extract_penalty_from_desc({ desc: undefined })).to.equal(null)
    })

    it('returns null for desc without penalty', () => {
      const desc =
        '(10:00) J.Allen pass short right to S.Diggs for 15 yards, TOUCHDOWN.'
      expect(extract_penalty_from_desc({ desc })).to.equal(null)
    })

    it('returns null for parsing errors (yard values as penalty)', () => {
      // These are edge cases where regex incorrectly extracts yard value
      const desc = 'Some malformed penalty description, 5 yards, enforced'
      expect(extract_penalty_from_desc({ desc })).to.equal(null)
    })
  })

  describe('normalize_penalty_type', function () {
    describe('direct mappings', function () {
      it('normalizes Face Mask to Face Mask (15 Yards)', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Face Mask' })
        ).to.equal('Face Mask (15 Yards)')
      })

      it('preserves Face Mask (5 Yards)', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Face Mask (5 Yards)' })
        ).to.equal('Face Mask (5 Yards)')
      })

      it('preserves Face Mask (15 Yards)', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Face Mask (15 Yards)' })
        ).to.equal('Face Mask (15 Yards)')
      })
    })

    describe('historical renames', function () {
      it('normalizes Defensive 12 On-field', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Defensive 12 On-field'
          })
        ).to.equal('Defensive Too Many Men on Field')
      })

      it('normalizes Offensive 12 On-field', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Offensive 12 On-field'
          })
        ).to.equal('Offensive Too Many Men on Field')
      })

      it('normalizes Player Out of Bounds on Punt', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Player Out of Bounds on Punt'
          })
        ).to.equal('Player Out of Bounds on Kick')
      })

      it('normalizes Interference with Opportunity to Catch', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Interference with Opportunity to Catch'
          })
        ).to.equal('Kick Catch Interference')
      })

      it('normalizes Lowering the Head to Initiate Contact', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Lowering the Head to Initiate Contact'
          })
        ).to.equal('Lowering the Head to Make Forcible Contact')
      })

      it('normalizes Horse Collar to Horse Collar Tackle', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Horse Collar' })
        ).to.equal('Horse Collar Tackle')
      })
    })

    describe('side-specific penalties', function () {
      it('adds / Offense suffix when pen_team equals off_team', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Unnecessary Roughness',
            pen_team: 'DAL',
            off_team: 'DAL'
          })
        ).to.equal('Unnecessary Roughness / Offense')
      })

      it('adds / Defense suffix when pen_team differs from off_team', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Unnecessary Roughness',
            pen_team: 'NYG',
            off_team: 'DAL'
          })
        ).to.equal('Unnecessary Roughness / Defense')
      })

      it('handles case-insensitive team comparison', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Taunting',
            pen_team: 'dal',
            off_team: 'DAL'
          })
        ).to.equal('Taunting / Offense')
      })

      it('returns without suffix when off_team is missing', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Unsportsmanlike Conduct',
            pen_team: 'DAL',
            off_team: null
          })
        ).to.equal('Unsportsmanlike Conduct')
      })

      it('returns without suffix when pen_team is missing', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Personal Foul',
            pen_team: null,
            off_team: 'DAL'
          })
        ).to.equal('Personal Foul')
      })

      it('applies side suffix to all SIDE_SPECIFIC_PENALTIES', () => {
        for (const penalty of SIDE_SPECIFIC_PENALTIES) {
          const result_offense = normalize_penalty_type({
            raw_penalty_type: penalty,
            pen_team: 'DAL',
            off_team: 'DAL'
          })
          expect(result_offense).to.include('/ Offense')

          const result_defense = normalize_penalty_type({
            raw_penalty_type: penalty,
            pen_team: 'NYG',
            off_team: 'DAL'
          })
          expect(result_defense).to.include('/ Defense')
        }
      })
    })

    describe('passthrough behavior', function () {
      it('passes through unknown penalty types unchanged', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Some Unknown Penalty' })
        ).to.equal('Some Unknown Penalty')
      })

      it('passes through already canonical names', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Offensive Holding' })
        ).to.equal('Offensive Holding')
        expect(
          normalize_penalty_type({ raw_penalty_type: 'False Start' })
        ).to.equal('False Start')
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Defensive Pass Interference'
          })
        ).to.equal('Defensive Pass Interference')
      })
    })

    describe('null handling', function () {
      it('returns null for null input', () => {
        expect(normalize_penalty_type({ raw_penalty_type: null })).to.equal(
          null
        )
      })

      it('returns null for undefined input', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: undefined })
        ).to.equal(null)
      })

      it('returns null for invalid penalty names (yard values)', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: '5 yards' })
        ).to.equal(null)
        expect(
          normalize_penalty_type({ raw_penalty_type: '10 yards' })
        ).to.equal(null)
      })
    })
  })

  describe('get_canonical_penalty_type', function () {
    it('extracts and normalizes in one step', () => {
      const desc =
        '(10:00) G.Edwards left guard. PENALTY on LAC-Q.Johnston, Illegal Formation, 5 yards - No Play.'
      expect(
        get_canonical_penalty_type({
          desc,
          pen_team: 'LAC',
          off_team: 'LAC'
        })
      ).to.equal('Illegal Formation')
    })

    it('extracts and normalizes side-specific penalty', () => {
      const desc =
        'J.Allen scrambles. PENALTY on BUF-J.Allen, Unnecessary Roughness, 15 yards, enforced.'
      expect(
        get_canonical_penalty_type({
          desc,
          pen_team: 'BUF',
          off_team: 'BUF'
        })
      ).to.equal('Unnecessary Roughness / Offense')

      expect(
        get_canonical_penalty_type({
          desc,
          pen_team: 'BUF',
          off_team: 'MIA'
        })
      ).to.equal('Unnecessary Roughness / Defense')
    })

    it('returns null when extraction fails', () => {
      const desc = 'J.Allen pass complete to S.Diggs for 15 yards.'
      expect(
        get_canonical_penalty_type({
          desc,
          pen_team: 'BUF',
          off_team: 'BUF'
        })
      ).to.equal(null)
    })
  })

  describe('constants', function () {
    it('PENALTY_TYPE_CANONICAL_MAP has expected mappings', () => {
      expect(PENALTY_TYPE_CANONICAL_MAP['Face Mask']).to.equal(
        'Face Mask (15 Yards)'
      )
      expect(PENALTY_TYPE_CANONICAL_MAP['Defensive 12 On-field']).to.equal(
        'Defensive Too Many Men on Field'
      )
    })

    it('SIDE_SPECIFIC_PENALTIES contains expected penalties', () => {
      expect(SIDE_SPECIFIC_PENALTIES.has('Unnecessary Roughness')).to.equal(
        true
      )
      expect(SIDE_SPECIFIC_PENALTIES.has('Taunting')).to.equal(true)
      expect(SIDE_SPECIFIC_PENALTIES.has('False Start')).to.equal(false)
    })
  })
})
