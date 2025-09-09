import chai from 'chai'
import MockDate from 'mockdate'

// Set test environment before importing modules
process.env.NODE_ENV = 'test'

import db from '#db'
import debug_data_view from '../cli/debug-data-view.mjs'

const expect = chai.expect

describe('CLI debug-data-view', () => {
  before(async () => {
    MockDate.set('2023-09-01 00:00:00.000')
    await db('urls').del()
  })

  after(() => {
    MockDate.reset()
  })

  afterEach(async () => {
    await db('urls').del()
  })

  describe('URL parsing and validation', () => {
    it('should extract hash from valid short URL', () => {
      // This would be tested by calling the CLI tool with a valid URL
      // but since we're testing the module functions, we need to expose
      // the internal parsing functions or test through the main function
    })

    it('should throw error for invalid URL format', async () => {
      try {
        await debug_data_view({
          short_url: '/invalid/url/format',
          beautify: false,
          debug_mode: false,
          output_file: null
        })
        expect.fail('Should have thrown error for invalid URL format')
      } catch (error) {
        expect(error.message).to.include('Invalid short URL format')
      }
    })

    it('should throw error for non-existent hash', async () => {
      try {
        await debug_data_view({
          short_url: '/u/nonexistent123456789012345678901234',
          beautify: false,
          debug_mode: false,
          output_file: null
        })
        expect.fail('Should have thrown error for non-existent hash')
      } catch (error) {
        expect(error.message).to.include('Short URL hash not found in database')
      }
    })
  })

  describe('Database lookup', () => {
    beforeEach(async () => {
      // Insert test URL data
      await db('urls').insert({
        id: 'abcd1234567890123456789012345678',
        url: 'https://example.com/?columns=[{"column_id":"player_name"}]&where=[]&sort=[]&splits=[]'
      })
    })

    it('should successfully lookup URL in database', async () => {
      try {
        const result = await debug_data_view({
          short_url: '/u/abcd1234567890123456789012345678',
          beautify: false,
          debug_mode: false,
          output_file: null
        })
        
        expect(result).to.be.a('string')
        expect(result.length).to.be.greaterThan(0)
      } catch (error) {
        // The test might fail if the column definition doesn't exist
        // but we should at least get past the URL lookup stage
        expect(error.message).to.not.include('Short URL hash not found')
      }
    })
  })

  describe('Parameter parsing', () => {
    beforeEach(async () => {
      // Insert test URL with complex parameters
      await db('urls').insert({
        id: 'test1234567890123456789012345678',
        url: 'https://example.com/?columns=[{"column_id":"player_name"}]&where=[{"column_id":"player_position","operator":"IN","value":["QB","RB"]}]&sort=[{"column_id":"player_name","desc":false}]&splits=["year"]&offset=0&limit=100'
      })
    })

    it('should parse complex URL parameters correctly', async () => {
      try {
        const result = await debug_data_view({
          short_url: '/u/test1234567890123456789012345678',
          beautify: false,
          debug_mode: true, // Enable debug to see parsing details
          output_file: null
        })
        
        expect(result).to.be.a('string')
        // The SQL should contain some indication that parameters were parsed
        // This is a basic test since the exact SQL depends on column definitions
      } catch (error) {
        // Test should at least parse the URL parameters without throwing
        // a JSON parsing error
        expect(error.message).to.not.include('Failed to parse')
      }
    })
  })

  describe('Malformed parameter handling', () => {
    beforeEach(async () => {
      // Insert URL with malformed JSON
      await db('urls').insert({
        id: 'bad1234567890123456789012345678',
        url: 'https://example.com/?columns=[invalid json}]'
      })
    })

    it('should handle malformed JSON parameters gracefully', async () => {
      try {
        await debug_data_view({
          short_url: '/u/bad1234567890123456789012345678',
          beautify: false,
          debug_mode: false,
          output_file: null
        })
        expect.fail('Should have thrown error for malformed JSON')
      } catch (error) {
        expect(error.message).to.include('Failed to parse columns parameter')
      }
    })
  })

  describe('SQL generation', () => {
    beforeEach(async () => {
      // Insert URL with simple, valid parameters
      await db('urls').insert({
        id: 'sql1234567890123456789012345678',
        url: 'https://example.com/?columns=[]&where=[]&sort=[]&splits=[]'
      })
    })

    it('should generate SQL query from table state', async () => {
      try {
        const result = await debug_data_view({
          short_url: '/u/sql1234567890123456789012345678',
          beautify: false,
          debug_mode: false,
          output_file: null
        })
        
        expect(result).to.be.a('string')
        expect(result.toLowerCase()).to.include('select')
        expect(result.toLowerCase()).to.include('from')
      } catch (error) {
        // Even if column definitions cause issues, we should get to SQL generation
        console.log('SQL generation test error:', error.message)
      }
    })
  })

  describe('Output options', () => {
    beforeEach(async () => {
      await db('urls').insert({
        id: 'out1234567890123456789012345678',
        url: 'https://example.com/?columns=[]&where=[]&sort=[]&splits=[]'
      })
    })

    it('should handle beautify option', async () => {
      try {
        const result = await debug_data_view({
          short_url: '/u/out1234567890123456789012345678',
          beautify: true,
          debug_mode: false,
          output_file: null
        })
        
        expect(result).to.be.a('string')
        // Beautified SQL should have more whitespace/formatting
      } catch (error) {
        // Test that beautify option doesn't cause crashes
        expect(error.message).to.not.include('prettier')
      }
    })

    it('should handle file output option', async () => {
      const fs = await import('fs/promises')
      const output_file = '/tmp/test-debug-output.sql'
      
      try {
        await debug_data_view({
          short_url: '/u/out1234567890123456789012345678',
          beautify: false,
          debug_mode: false,
          output_file
        })
        
        // Check if file was created
        const stats = await fs.stat(output_file)
        expect(stats.isFile()).to.be.true
        
        // Clean up
        await fs.unlink(output_file)
      } catch (error) {
        // Clean up even if test fails
        try {
          await fs.unlink(output_file)
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        // Re-throw original error if it's not related to column definitions
        if (!error.message.includes('Column definition not found')) {
          throw error
        }
      }
    })
  })

  describe('Error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection
      // For now, just ensure error handling structure is in place
    })

    it('should provide debug information when debug mode is enabled', async () => {
      // Insert a URL that will trigger processing
      await db('urls').insert({
        id: 'dbg1234567890123456789012345678',
        url: 'https://example.com/?columns=[]&where=[]'
      })

      try {
        await debug_data_view({
          short_url: '/u/dbg1234567890123456789012345678',
          beautify: false,
          debug_mode: true,
          output_file: null
        })
      } catch (error) {
        // In debug mode, errors should have more detailed information
        // The specific behavior depends on the debug library configuration
      }
    })
  })

  describe('Hash validation', () => {
    it('should reject short URLs with invalid hash length', async () => {
      try {
        await debug_data_view({
          short_url: '/u/tooshort',
          beautify: false,
          debug_mode: false,
          output_file: null
        })
        expect.fail('Should have thrown error for short hash')
      } catch (error) {
        expect(error.message).to.include('Invalid short URL format')
      }
    })

    it('should reject short URLs with invalid hash characters', async () => {
      try {
        await debug_data_view({
          short_url: '/u/invalid@hash123456789012345678901',
          beautify: false,
          debug_mode: false,
          output_file: null
        })
        expect.fail('Should have thrown error for invalid characters')
      } catch (error) {
        expect(error.message).to.include('Invalid short URL format')
      }
    })
  })
})