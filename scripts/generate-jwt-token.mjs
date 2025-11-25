import debug from 'debug'
import jwt from 'jsonwebtoken'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main } from '#libs-server'
import config from '#config'

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('user_id', {
      alias: 'u',
      describe: 'User ID to generate token for',
      type: 'number',
      demandOption: true
    })
    .help().argv
}

const log = debug('generate-jwt-token')
debug.enable('generate-jwt-token')

const script = async ({ user_id }) => {
  // Create payload with userId
  const payload = { userId: user_id }

  // Sign the token with the JWT secret from config
  const token = jwt.sign(payload, config.jwt.secret)

  // Output the token
  log(`Generated JWT token for user_id: ${user_id}`)
  console.log(token)

  return token
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await script({ user_id: argv.user_id })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default script
