import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'

const argv = yargs(hideBin(process.argv))
  .option('created_by', {
    alias: 'u',
    describe: 'User ID creating the invite code',
    type: 'number',
    default: 1
  })
  .option('max_uses', {
    alias: 'm',
    describe: 'Maximum number of uses (null for unlimited)',
    type: 'number',
    default: 1
  })
  .option('expires_in_days', {
    alias: 'e',
    describe: 'Number of days until expiration (null for no expiration)',
    type: 'number',
    default: null
  })
  .option('code', {
    alias: 'c',
    describe: 'Custom invite code (will be generated if not provided)',
    type: 'string'
  })
  .help()
  .example(
    '$0 --created_by 1',
    'Generate unlimited use code with no expiration'
  )
  .example(
    '$0 -u 1 -m 10 -e 30',
    'Generate code with 10 uses that expires in 30 days'
  )
  .example(
    '$0 -u 1 -c WELCOME2024',
    'Generate code with custom code string'
  ).argv

const log = debug('generate-invite-code')
debug.enable('generate-invite-code')

const generate_random_code = () => {
  // Generate a random 20-character code using alphanumeric characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 20; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

const script = async ({
  created_by,
  max_uses,
  expires_in_days,
  custom_code
}) => {
  // Generate or use custom code
  const code = custom_code || generate_random_code()

  // Calculate expiration date if specified
  let expires_at = null
  if (expires_in_days) {
    const expiration_date = new Date()
    expiration_date.setDate(expiration_date.getDate() + expires_in_days)
    expires_at = expiration_date
  }

  // Verify user exists
  const user = await db('users').where({ id: created_by }).first()
  if (!user) {
    throw new Error(`User with id ${created_by} does not exist`)
  }

  // Check if code already exists
  const existing_code = await db('invite_codes').where({ code }).first()
  if (existing_code) {
    throw new Error(`Invite code "${code}" already exists`)
  }

  // Insert the invite code
  await db('invite_codes').insert({
    code,
    created_by,
    max_uses,
    expires_at,
    is_active: true,
    uses_count: 0
  })

  // Log the result
  log(`Generated invite code: ${code}`)
  log(`Created by user_id: ${created_by}`)
  log(`Max uses: ${max_uses === null ? 'unlimited' : max_uses}`)
  log(`Expires at: ${expires_at ? expires_at.toISOString() : 'never'}`)

  // Output the code prominently
  console.log('\n' + '='.repeat(60))
  console.log(`INVITE CODE: ${code}`)
  console.log('='.repeat(60))
  console.log(`Created by: User #${created_by} (${user.username})`)
  console.log(`Max uses: ${max_uses === null ? 'Unlimited' : max_uses}`)
  console.log(`Expires: ${expires_at ? expires_at.toISOString() : 'Never'}`)
  console.log('='.repeat(60) + '\n')

  return { code, created_by, max_uses, expires_at }
}

const main = async () => {
  let error
  try {
    await script({
      created_by: argv.created_by,
      max_uses: argv.max_uses,
      expires_in_days: argv.expires_in_days,
      custom_code: argv.code
    })
  } catch (err) {
    error = err
    log(error)
    console.error(`Error: ${error.message}`)
  }

  await db.destroy()
  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default script
