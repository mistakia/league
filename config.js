// Parse command line arguments manually
const parse_argv = () => {
  const args = process.argv.slice(2)
  const parsed = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value =
        args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true
      parsed[key] = value
      if (value !== true) i++ // Skip next argument if it was used as value
    }
  }

  return parsed
}

const argv = parse_argv()
const env = process.env.NODE_ENV || 'development'
const config_path = argv.config || `./config.${env}`
module.exports = require(config_path)
