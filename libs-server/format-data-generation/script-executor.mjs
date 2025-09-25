// Script executor module
// Handle script execution and process management

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import { SCRIPT_CONFIG } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Execute a script with arguments
 * @param {Object} params - Parameters object
 * @param {string} params.script_name - Name of the script to execute
 * @param {string[]} [params.args=[]] - Arguments to pass to the script
 * @returns {Promise<void>}
 * @throws {Error} If script execution fails
 */
export const execute_script = ({ script_name, args = [] }) => {
  return new Promise((resolve, reject) => {
    const script_path = path.join(__dirname, '../../scripts', script_name)
    console.log(`\nExecuting: node ${script_name} ${args.join(' ')}`)

    const child = spawn('node', [script_path, ...args], {
      stdio: 'inherit',
      cwd: path.dirname(path.dirname(__dirname))
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`Completed: ${script_name}`)
        // Add a small delay to allow connections to properly close
        setTimeout(resolve, SCRIPT_CONFIG.script_delay)
      } else {
        console.error(`Failed: ${script_name} (exit code ${code})`)
        reject(new Error(`Script ${script_name} failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      console.error(`Error executing ${script_name}:`, error.message)
      reject(error)
    })
  })
}

/**
 * Check if a script file exists
 * @param {Object} params - Parameters object
 * @param {string} params.script_name - Name of the script to check
 * @returns {Promise<boolean>}
 */
export const script_exists = async ({ script_name }) => {
  try {
    const script_path = path.join(__dirname, '../../scripts', script_name)
    const { access } = await import('fs/promises')
    await access(script_path)
    return true
  } catch {
    return false
  }
}

/**
 * Prepare script arguments by replacing placeholders with actual values
 * @param {Object} params - Parameters object
 * @param {string[]} params.args - Original arguments with placeholders
 * @param {string} params.format_hash - Format hash to use for placeholders
 * @returns {string[]} Processed arguments with placeholders replaced
 */
export const prepare_script_args = ({ args, format_hash }) => {
  return args.map((arg) => {
    if (arg === '{scoring_format_hash}') return format_hash
    if (arg === '{league_format_hash}') return format_hash
    return arg
  })
}
