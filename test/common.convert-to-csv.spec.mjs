/* global describe it */

import * as chai from 'chai'

import convert_to_csv from '#libs-shared/convert-to-csv.mjs'

const expect = chai.expect

describe('LIBS-SHARED convert_to_csv', function () {
  describe('header line', function () {
    it('derives columns from the first row when none are given', () => {
      const csv = convert_to_csv({ rows: [{ pid: 'A', pos: 'QB' }] })
      expect(csv).to.equal('pid,pos\r\nA,QB\r\n')
    })

    it('uses the given column order, not the row key order', () => {
      const csv = convert_to_csv({
        rows: [{ pid: 'A', pos: 'QB' }],
        columns: ['pos', 'pid']
      })
      expect(csv).to.equal('pos,pid\r\nQB,A\r\n')
    })

    it('renders a display header that differs from the row key', () => {
      const csv = convert_to_csv({
        rows: [{ tid: 3 }],
        columns: [{ key: 'tid', header: 'Team Id' }]
      })
      expect(csv).to.equal('Team Id\r\n3\r\n')
    })

    it('mixes bare-string and display-header columns', () => {
      const csv = convert_to_csv({
        rows: [{ tid: 3, pos: 'QB' }],
        columns: [{ key: 'tid', header: 'Team Id' }, 'pos']
      })
      expect(csv).to.equal('Team Id,pos\r\n3,QB\r\n')
    })
  })

  describe('column set', function () {
    it('ignores row keys outside the column set', () => {
      const csv = convert_to_csv({
        rows: [{ pid: 'A', secret: 'hidden' }],
        columns: ['pid']
      })
      expect(csv).to.equal('pid\r\nA\r\n')
    })

    it('renders a key missing from a row as an empty cell', () => {
      const csv = convert_to_csv({
        rows: [{ pid: 'A' }, { pid: 'B', week: 2 }],
        columns: ['pid', 'week']
      })
      expect(csv).to.equal('pid,week\r\nA,\r\nB,2\r\n')
    })

    it('does not mutate the rows it is given', () => {
      const rows = [{ pid: 'A' }]
      convert_to_csv({ rows, columns: [{ key: 'pid', header: 'Player Id' }] })
      expect(rows).to.deep.equal([{ pid: 'A' }])
    })
  })

  describe('empty input', function () {
    it('returns an empty string for zero rows rather than throwing', () => {
      expect(convert_to_csv({ rows: [] })).to.equal('')
      expect(convert_to_csv({ rows: [], columns: ['pid'] })).to.equal('')
    })

    it('returns an empty string for absent rows', () => {
      expect(convert_to_csv({ rows: undefined })).to.equal('')
      expect(convert_to_csv({ rows: null })).to.equal('')
    })
  })

  describe('value formatting', function () {
    it('renders null and undefined as empty cells', () => {
      const csv = convert_to_csv({
        rows: [{ a: null, b: undefined }],
        columns: ['a', 'b']
      })
      expect(csv).to.equal('a,b\r\n,\r\n')
    })

    it('renders a Date as an ISO string', () => {
      const csv = convert_to_csv({
        rows: [{ at: new Date('2026-08-27T12:00:00.000Z') }]
      })
      expect(csv).to.equal('at\r\n2026-08-27T12:00:00.000Z\r\n')
    })

    it('renders an object cell as JSON', () => {
      const csv = convert_to_csv({ rows: [{ meta: { a: 1 } }] })
      expect(csv).to.equal('meta\r\n"{""a"":1}"\r\n')
    })

    it('renders zero and false rather than blanking them', () => {
      const csv = convert_to_csv({
        rows: [{ points: 0, started: false }]
      })
      expect(csv).to.equal('points,started\r\n0,false\r\n')
    })
  })

  // Locks the escaping behavior byte for byte.
  describe('escaping', function () {
    it('neutralizes a leading = so a spreadsheet treats it as text', () => {
      const csv = convert_to_csv({
        rows: [{ name: '=HYPERLINK("http://x","c")' }]
      })
      expect(csv).to.equal('name\r\n"\'=HYPERLINK(""http://x"",""c"")"\r\n')
    })

    it('neutralizes the other formula leads, including tab and CR', () => {
      for (const lead of ['+', '@', '\t', '\r']) {
        const csv = convert_to_csv({ rows: [{ v: `${lead}cmd` }] })
        expect(csv, `lead ${JSON.stringify(lead)}`).to.contain(`'${lead}cmd`)
      }
    })

    it('neutralizes a formula in a HEADER, not just a data cell', () => {
      const csv = convert_to_csv({
        rows: [{ v: 1 }],
        columns: [{ key: 'v', header: '=1+1' }]
      })
      expect(csv).to.equal("'=1+1\r\n1\r\n")
    })

    it('leaves a negative number alone so it still sums', () => {
      const csv = convert_to_csv({ rows: [{ v: -3.5 }, { v: -7 }] })
      expect(csv).to.equal('v\r\n-3.5\r\n-7\r\n')
    })

    it('neutralizes a non-numeric value that merely starts with -', () => {
      const csv = convert_to_csv({ rows: [{ v: '-lookup()' }] })
      expect(csv).to.equal("v\r\n'-lookup()\r\n")
    })

    it('quotes a value containing a comma', () => {
      const csv = convert_to_csv({ rows: [{ name: 'Smith, John' }] })
      expect(csv).to.equal('name\r\n"Smith, John"\r\n')
    })

    it('doubles and quotes an embedded quote', () => {
      const csv = convert_to_csv({ rows: [{ name: 'He said "hi"' }] })
      expect(csv).to.equal('name\r\n"He said ""hi"""\r\n')
    })

    it('quotes a value containing a newline or carriage return', () => {
      expect(convert_to_csv({ rows: [{ a: 'x\ny' }] })).to.equal(
        'a\r\n"x\ny"\r\n'
      )
      expect(convert_to_csv({ rows: [{ a: 'x\ry' }] })).to.equal(
        'a\r\n"x\ry"\r\n'
      )
    })

    it('leaves a value needing no escape unquoted', () => {
      const csv = convert_to_csv({ rows: [{ name: "O'Brien" }] })
      expect(csv).to.equal("name\r\nO'Brien\r\n")
    })

    it('escapes a header cell on the same terms as a data cell', () => {
      const csv = convert_to_csv({
        rows: [{ tid: 1 }],
        columns: [{ key: 'tid', header: 'Team, Id' }]
      })
      expect(csv).to.equal('"Team, Id"\r\n1\r\n')
    })
  })
})
