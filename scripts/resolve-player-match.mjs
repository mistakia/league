import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, createPlayer, updatePlayer, mergePlayer } from '#libs-server'
import { format_player_name } from '#libs-shared'

const log = debug('resolve-player-match')
debug.enable('resolve-player-match,create-player,update-player,merge-player')

const external_id_columns = [
  'pff_id',
  'draftkings_id',
  'fanduel_id',
  'espn_id',
  'sleeper_id',
  'yahoo_id',
  'sportradar_id',
  'nfl_id',
  'gsisid',
  'esbid',
  'rotowire_id',
  'rotoworld_id',
  'cbs_id',
  'mfl_id',
  'pfr_id',
  'otc_id',
  'keeptradecut_id',
  'fantasy_data_id',
  'rts_id',
  'fleaflicker_id'
]

const get_external_id_from_argv = (argv) => {
  for (const column of external_id_columns) {
    const arg_name = column.replace(/_/g, '-')
    if (argv[arg_name] !== undefined) {
      return { column, value: argv[arg_name] }
    }
  }
  return null
}

const action_create_player = async (argv) => {
  const { fname, lname, pos, team, dob, draftYear } = argv

  if (!fname || !lname) {
    throw new Error('--fname and --lname are required')
  }

  if (!pos) {
    throw new Error('--pos is required')
  }

  const player_data = {
    fname,
    lname,
    pos,
    pos1: pos,
    posd: pos,
    current_nfl_team: team || 'INA',
    dob: dob || '0000-00-00',
    nfl_draft_year: draftYear || new Date().getFullYear(),
    height: argv.height || 72,
    weight: argv.weight || 200
  }

  const external_id = get_external_id_from_argv(argv)
  if (external_id) {
    player_data[external_id.column] = external_id.value
  }

  log(`Creating player: ${fname} ${lname}`)
  log(player_data)

  const result = await createPlayer(player_data)

  if (result) {
    log(`Successfully created player: ${result.pid}`)
    return result
  } else {
    throw new Error('Failed to create player')
  }
}

const action_update_external_id = async (argv) => {
  const { pid } = argv

  if (!pid) {
    throw new Error('--pid is required')
  }

  const external_id = get_external_id_from_argv(argv)
  if (!external_id) {
    throw new Error(
      'At least one external ID argument is required (e.g., --pff-id, --draftkings-id)'
    )
  }

  log(
    `Updating player ${pid} with ${external_id.column} = ${external_id.value}`
  )

  const update = { [external_id.column]: external_id.value }
  const changes = await updatePlayer({
    pid,
    update,
    allow_protected_props: true
  })

  if (changes > 0) {
    log(`Successfully updated ${changes} field(s)`)
  } else {
    log('No changes made (value may already be set)')
  }

  return changes
}

const action_add_alias = async (argv) => {
  const { pid, alias } = argv

  if (!pid) {
    throw new Error('--pid is required')
  }

  if (!alias) {
    throw new Error('--alias is required')
  }

  const formatted_alias = format_player_name(alias)

  log(`Adding alias "${formatted_alias}" for player ${pid}`)

  const existing = await db('player_aliases')
    .where({ pid, formatted_alias })
    .first()

  if (existing) {
    log('Alias already exists')
    return 0
  }

  await db('player_aliases').insert({
    pid,
    formatted_alias
  })

  log('Successfully added alias')
  return 1
}

const action_merge_players = async (argv) => {
  const { keepPid, removePid } = argv

  if (!keepPid) {
    throw new Error('--keep-pid is required')
  }

  if (!removePid) {
    throw new Error('--remove-pid is required')
  }

  const keep_player_rows = await db('player').where({ pid: keepPid })
  const remove_player_rows = await db('player').where({ pid: removePid })

  if (!keep_player_rows.length) {
    throw new Error(`Player not found: ${keepPid}`)
  }

  if (!remove_player_rows.length) {
    throw new Error(`Player not found: ${removePid}`)
  }

  log(`Merging player ${removePid} into ${keepPid}`)

  await mergePlayer({
    update_player_row: keep_player_rows[0],
    remove_player_row: remove_player_rows[0]
  })

  log('Successfully merged players')
  return 1
}

const action_search = async (argv) => {
  const { name, team, pos } = argv

  const query = db('player')
    .select(
      'pid',
      'fname',
      'lname',
      'formatted',
      'pos',
      'current_nfl_team',
      'nfl_draft_year',
      'dob'
    )
    .orderBy('nfl_draft_year', 'desc')
    .limit(20)

  if (name) {
    const formatted_name = format_player_name(name)
    query.where(function () {
      this.where('formatted', 'like', `%${formatted_name}%`).orWhereIn(
        'pid',
        function () {
          this.select('pid')
            .from('player_aliases')
            .where('formatted_alias', 'like', `%${formatted_name}%`)
        }
      )
    })
  }

  if (team) {
    query.where('current_nfl_team', team.toUpperCase())
  }

  if (pos) {
    query.where(function () {
      this.where('pos', pos.toUpperCase())
        .orWhere('pos1', pos.toUpperCase())
        .orWhere('pos2', pos.toUpperCase())
    })
  }

  const players = await query

  if (!players.length) {
    log('No players found')
    return []
  }

  log(`Found ${players.length} player(s):`)
  for (const player of players) {
    log(
      `  ${player.pid} - ${player.fname} ${player.lname} (${player.pos}, ${player.current_nfl_team}, ${player.nfl_draft_year})`
    )
  }

  return players
}

const main = async () => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .usage('Usage: $0 <action> [options]')
      .command('create', 'Create a new player', (yargs) => {
        return yargs
          .option('fname', { type: 'string', description: 'First name' })
          .option('lname', { type: 'string', description: 'Last name' })
          .option('pos', { type: 'string', description: 'Position' })
          .option('team', {
            type: 'string',
            description: 'NFL team abbreviation'
          })
          .option('dob', {
            type: 'string',
            description: 'Date of birth (YYYY-MM-DD)'
          })
          .option('draft-year', {
            type: 'number',
            description: 'NFL draft year'
          })
          .option('height', { type: 'number', description: 'Height in inches' })
          .option('weight', { type: 'number', description: 'Weight in pounds' })
      })
      .command('update-id', 'Update external ID for a player', (yargs) => {
        return yargs.option('pid', { type: 'string', description: 'Player ID' })
      })
      .command('add-alias', 'Add name alias for a player', (yargs) => {
        return yargs
          .option('pid', { type: 'string', description: 'Player ID' })
          .option('alias', { type: 'string', description: 'Alias name to add' })
      })
      .command('merge', 'Merge duplicate players', (yargs) => {
        return yargs
          .option('keep-pid', {
            type: 'string',
            description: 'Player ID to keep'
          })
          .option('remove-pid', {
            type: 'string',
            description: 'Player ID to remove'
          })
      })
      .command('search', 'Search for players', (yargs) => {
        return yargs
          .option('name', {
            type: 'string',
            description: 'Player name to search'
          })
          .option('team', {
            type: 'string',
            description: 'NFL team abbreviation'
          })
          .option('pos', { type: 'string', description: 'Position' })
      })
      .option('pff-id', { type: 'number', description: 'PFF player ID' })
      .option('draftkings-id', {
        type: 'number',
        description: 'DraftKings player ID'
      })
      .option('fanduel-id', {
        type: 'string',
        description: 'FanDuel player ID'
      })
      .option('espn-id', { type: 'number', description: 'ESPN player ID' })
      .option('sleeper-id', {
        type: 'string',
        description: 'Sleeper player ID'
      })
      .option('yahoo-id', { type: 'number', description: 'Yahoo player ID' })
      .option('sportradar-id', {
        type: 'string',
        description: 'Sportradar player ID'
      })
      .option('nfl-id', { type: 'number', description: 'NFL player ID' })
      .option('gsisid', { type: 'string', description: 'GSIS player ID' })
      .option('esbid', { type: 'string', description: 'ESB player ID' })
      .option('rotowire-id', {
        type: 'number',
        description: 'Rotowire player ID'
      })
      .option('rotoworld-id', {
        type: 'number',
        description: 'Rotoworld player ID'
      })
      .option('cbs-id', { type: 'number', description: 'CBS player ID' })
      .option('mfl-id', { type: 'number', description: 'MFL player ID' })
      .option('pfr-id', {
        type: 'string',
        description: 'Pro Football Reference player ID'
      })
      .option('otc-id', {
        type: 'number',
        description: 'Over The Cap player ID'
      })
      .option('keeptradecut-id', {
        type: 'number',
        description: 'KeepTradeCut player ID'
      })
      .demandCommand(1, 'You must specify an action')
      .help().argv

    const action = argv._[0]

    switch (action) {
      case 'create':
        await action_create_player(argv)
        break
      case 'update-id':
        await action_update_external_id(argv)
        break
      case 'add-alias':
        await action_add_alias(argv)
        break
      case 'merge':
        await action_merge_players(argv)
        break
      case 'search':
        await action_search(argv)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (err) {
    error = err
    log(error)
    console.error(error.message)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export {
  action_create_player,
  action_update_external_id,
  action_add_alias,
  action_merge_players,
  action_search
}
