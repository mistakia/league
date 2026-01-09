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

    describe('desc_nflfastr parameter', function () {
      it('uses desc_nflfastr when provided', () => {
        const desc_nflfastr =
          'R.Succop kicks 65 yards from TEN 35 to end zone, Touchback. PENALTY on TEN-45-J.Fowler, Offside on Free Kick, 5 yards, enforced at IND 25.'
        expect(extract_penalty_from_desc({ desc_nflfastr })).to.equal(
          'Offside on Free Kick'
        )
      })

      it('falls back to desc when desc_nflfastr is null', () => {
        const desc =
          '(12:12) (Shotgun) J.Herbert pass incomplete. PENALTY on CAR-J.Clowney, Illegal Use of Hands, 5 yards, enforced at CAR 45 - No Play.'
        expect(
          extract_penalty_from_desc({ desc, desc_nflfastr: null })
        ).to.equal('Illegal Use of Hands')
      })

      it('prefers desc_nflfastr over desc when both provided', () => {
        // NGS truncated desc without penalty
        const desc =
          'R.Succop kicks 65 yards from TEN 35 to end zone, Touchback.'
        // nflfastr complete desc with penalty
        const desc_nflfastr =
          'R.Succop kicks 65 yards from TEN 35 to end zone, Touchback. PENALTY on TEN-45-J.Fowler, Offside on Free Kick, 5 yards, enforced at IND 25.'
        expect(extract_penalty_from_desc({ desc, desc_nflfastr })).to.equal(
          'Offside on Free Kick'
        )
      })

      it('returns null when both desc and desc_nflfastr are null', () => {
        expect(
          extract_penalty_from_desc({ desc: null, desc_nflfastr: null })
        ).to.equal(null)
      })
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
        ).to.equal('Player Out of Bounds on Kick / Offense')
      })

      it('normalizes Interference with Opportunity to Catch', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Interference with Opportunity to Catch'
          })
        ).to.equal('Kick Catch Interference / Defense')
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

      it('normalizes Player Out of Bounds on a Punt', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Player Out of Bounds on a Punt'
          })
        ).to.equal('Player Out of Bounds on Kick / Offense')
      })
    })

    describe('sportradar-specific normalizations', function () {
      it('normalizes Offensive Facemask and applies dynamic suffix', () => {
        // Sportradar prefix is stripped, then dynamic suffix is applied
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Offensive Facemask',
            pen_team: 'DAL',
            off_team: 'DAL'
          })
        ).to.equal('Face Mask (15 Yards) / Offense')

        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Offensive Facemask',
            pen_team: 'NYG',
            off_team: 'DAL'
          })
        ).to.equal('Face Mask (15 Yards) / Defense')
      })

      it('normalizes Offensive Illegal Block Above the Waist with dynamic suffix', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Offensive Illegal Block Above the Waist',
            pen_team: 'DAL',
            off_team: 'DAL'
          })
        ).to.equal('Illegal Block Above the Waist / Offense')

        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Offensive Illegal Block Above the Waist',
            pen_team: 'NYG',
            off_team: 'DAL'
          })
        ).to.equal('Illegal Block Above the Waist / Defense')
      })

      it('normalizes Defensive Illegal Blindside Block with dynamic suffix', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Defensive Illegal Blindside Block',
            pen_team: 'DAL',
            off_team: 'DAL'
          })
        ).to.equal('Illegal Blindside Block / Offense')

        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Defensive Illegal Blindside Block',
            pen_team: 'NYG',
            off_team: 'DAL'
          })
        ).to.equal('Illegal Blindside Block / Defense')
      })

      it('normalizes Offensive Low Block with dynamic suffix', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Offensive Low Block',
            pen_team: 'DAL',
            off_team: 'DAL'
          })
        ).to.equal('Low Block / Offense')
      })

      it('normalizes Defensive Chop Block with dynamic suffix', () => {
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Defensive Chop Block',
            pen_team: 'NYG',
            off_team: 'DAL'
          })
        ).to.equal('Chop Block / Defense')
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

      it('preserves penalties with existing unit designation', () => {
        // Penalties with Offensive/Defensive prefix are preserved as-is
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Offensive Holding' })
        ).to.equal('Offensive Holding')
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Defensive Pass Interference'
          })
        ).to.equal('Defensive Pass Interference')
      })

      it('adds unit suffix to offense-only penalties', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: 'False Start' })
        ).to.equal('False Start / Offense')
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Illegal Formation' })
        ).to.equal('Illegal Formation / Offense')
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Delay of Game' })
        ).to.equal('Delay of Game / Offense')
      })

      it('adds unit suffix to defense-only penalties', () => {
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Encroachment' })
        ).to.equal('Encroachment / Defense')
        expect(
          normalize_penalty_type({ raw_penalty_type: 'Roughing the Passer' })
        ).to.equal('Roughing the Passer / Defense')
        expect(
          normalize_penalty_type({
            raw_penalty_type: 'Neutral Zone Infraction'
          })
        ).to.equal('Neutral Zone Infraction / Defense')
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
      ).to.equal('Illegal Formation / Offense')
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

    describe('desc_nflfastr parameter', function () {
      it('uses desc_nflfastr when provided', () => {
        const desc_nflfastr =
          'R.Succop kicks 65 yards from TEN 35 to end zone, Touchback. PENALTY on TEN-45-J.Fowler, Offside on Free Kick, 5 yards, enforced at IND 25.'
        expect(
          get_canonical_penalty_type({
            desc_nflfastr,
            pen_team: 'TEN',
            off_team: 'TEN'
          })
        ).to.equal('Offside on Free Kick / Defense')
      })

      it('prefers desc_nflfastr over desc when both provided', () => {
        // NGS truncated desc without penalty
        const desc =
          'R.Succop kicks 65 yards from TEN 35 to end zone, Touchback.'
        // nflfastr complete desc with penalty
        const desc_nflfastr =
          'R.Succop kicks 65 yards from TEN 35 to end zone, Touchback. PENALTY on TEN-45-J.Fowler, Offside on Free Kick, 5 yards, enforced at IND 25.'
        expect(
          get_canonical_penalty_type({
            desc,
            desc_nflfastr,
            pen_team: 'TEN',
            off_team: 'TEN'
          })
        ).to.equal('Offside on Free Kick / Defense')
      })

      it('falls back to desc when desc_nflfastr is null', () => {
        const desc =
          '(12:12) (Shotgun) J.Herbert pass incomplete. PENALTY on CAR-J.Clowney, Illegal Use of Hands, 5 yards, enforced at CAR 45 - No Play.'
        expect(
          get_canonical_penalty_type({
            desc,
            desc_nflfastr: null,
            pen_team: 'CAR',
            off_team: 'LAC'
          })
        ).to.equal('Illegal Use of Hands / Defense')
      })
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

  describe('pipeline convergence', function () {
    // Verifies that extraction, nflfastr, and sportradar pipelines
    // all produce the same canonical output for the same penalty scenario

    it('converges on Face Mask penalty (offense commits)', () => {
      const pen_team = 'DAL'
      const off_team = 'DAL'

      // Extraction pipeline: extracts "Face Mask" from description
      const extraction_result = normalize_penalty_type({
        raw_penalty_type: 'Face Mask',
        pen_team,
        off_team
      })

      // nflfastr pipeline: receives "Face Mask (15 Yards)" from CSV
      const nflfastr_result = normalize_penalty_type({
        raw_penalty_type: 'Face Mask (15 Yards)',
        pen_team,
        off_team
      })

      // sportradar pipeline: receives "Offensive Facemask" from API
      const sportradar_result = normalize_penalty_type({
        raw_penalty_type: 'Offensive Facemask',
        pen_team,
        off_team
      })

      expect(extraction_result).to.equal('Face Mask (15 Yards) / Offense')
      expect(nflfastr_result).to.equal('Face Mask (15 Yards) / Offense')
      expect(sportradar_result).to.equal('Face Mask (15 Yards) / Offense')
    })

    it('converges on Face Mask penalty (defense commits)', () => {
      const pen_team = 'NYG'
      const off_team = 'DAL'

      const extraction_result = normalize_penalty_type({
        raw_penalty_type: 'Face Mask',
        pen_team,
        off_team
      })

      const nflfastr_result = normalize_penalty_type({
        raw_penalty_type: 'Face Mask (15 Yards)',
        pen_team,
        off_team
      })

      // Even if sportradar incorrectly labels it "Offensive Facemask",
      // we use pen_team vs off_team to determine the correct side
      const sportradar_result = normalize_penalty_type({
        raw_penalty_type: 'Offensive Facemask',
        pen_team,
        off_team
      })

      expect(extraction_result).to.equal('Face Mask (15 Yards) / Defense')
      expect(nflfastr_result).to.equal('Face Mask (15 Yards) / Defense')
      expect(sportradar_result).to.equal('Face Mask (15 Yards) / Defense')
    })

    it('converges on Illegal Block Above the Waist', () => {
      const pen_team = 'BAL'
      const off_team = 'BAL'

      const extraction_result = normalize_penalty_type({
        raw_penalty_type: 'Illegal Block Above the Waist',
        pen_team,
        off_team
      })

      const nflfastr_result = normalize_penalty_type({
        raw_penalty_type: 'Illegal Block Above the Waist',
        pen_team,
        off_team
      })

      const sportradar_result = normalize_penalty_type({
        raw_penalty_type: 'Offensive Illegal Block Above the Waist',
        pen_team,
        off_team
      })

      expect(extraction_result).to.equal(
        'Illegal Block Above the Waist / Offense'
      )
      expect(nflfastr_result).to.equal(
        'Illegal Block Above the Waist / Offense'
      )
      expect(sportradar_result).to.equal(
        'Illegal Block Above the Waist / Offense'
      )
    })

    it('converges on False Start (offense-only penalty)', () => {
      // False Start is always offense, so pen_team/off_team shouldn't matter
      const extraction_result = normalize_penalty_type({
        raw_penalty_type: 'False Start',
        pen_team: 'DAL',
        off_team: 'DAL'
      })

      const nflfastr_result = normalize_penalty_type({
        raw_penalty_type: 'False Start',
        pen_team: 'DAL',
        off_team: 'DAL'
      })

      expect(extraction_result).to.equal('False Start / Offense')
      expect(nflfastr_result).to.equal('False Start / Offense')
    })

    it('converges on Encroachment (defense-only penalty)', () => {
      const extraction_result = normalize_penalty_type({
        raw_penalty_type: 'Encroachment',
        pen_team: 'NYG',
        off_team: 'DAL'
      })

      const nflfastr_result = normalize_penalty_type({
        raw_penalty_type: 'Encroachment',
        pen_team: 'NYG',
        off_team: 'DAL'
      })

      expect(extraction_result).to.equal('Encroachment / Defense')
      expect(nflfastr_result).to.equal('Encroachment / Defense')
    })

    it('preserves standard prefixed names across pipelines', () => {
      // Offensive Holding and Defensive Holding are standard names
      // They should be preserved as-is regardless of source
      expect(
        normalize_penalty_type({
          raw_penalty_type: 'Offensive Holding',
          pen_team: 'DAL',
          off_team: 'DAL'
        })
      ).to.equal('Offensive Holding')

      expect(
        normalize_penalty_type({
          raw_penalty_type: 'Defensive Pass Interference',
          pen_team: 'NYG',
          off_team: 'DAL'
        })
      ).to.equal('Defensive Pass Interference')
    })
  })
})
