import config from '#config'
import { constants } from '#common'

export default function (prop_type) {
  switch (prop_type) {
    case constants.player_prop_types.GAME_PASSING_YARDS:
      return config.discord_props_open_passing_yards_channel_webhook_url

    case constants.player_prop_types.GAME_RECEIVING_YARDS:
      return config.discord_props_open_receiving_yards_channel_webhook_url

    case constants.player_prop_types.GAME_RUSHING_YARDS:
      return config.discord_props_open_rushing_yards_channel_webhook_url

    case constants.player_prop_types.GAME_PASSING_COMPLETIONS:
      return config.discord_props_open_passing_completions_channel_webhook_url

    case constants.player_prop_types.GAME_PASSING_TOUCHDOWNS:
      return config.discord_props_open_passing_touchdowns_channel_webhook_url

    case constants.player_prop_types.GAME_RECEPTIONS:
      return config.discord_props_open_receptions_channel_webhook_url

    case constants.player_prop_types.GAME_PASSING_INTERCEPTIONS:
      return config.discord_props_open_passing_interceptions_channel_webhook_url

    case constants.player_prop_types.GAME_RUSHING_ATTEMPTS:
      return config.discord_props_open_rushing_attempts_channel_webhook_url

    case constants.player_prop_types.GAME_SCRIMMAGE_YARDS:
      return config.discord_props_open_scrimmage_yards_channel_webhook_url

    case constants.player_prop_types.GAME_RECEIVING_TOUCHDOWNS:
      return config.discord_props_open_receiving_touchdowns_channel_webhook_url

    case constants.player_prop_types.GAME_RUSHING_TOUCHDOWNS:
      return config.discord_props_open_rushing_touchdowns_channel_webhook_url

    case constants.player_prop_types.GAME_PASSING_ATTEMPTS:
      return config.discord_props_open_passing_attempts_channel_webhook_url

    case constants.player_prop_types.GAME_PASSING_LONGEST_COMPLETION:
      return config.discord_props_open_longest_completion_channel_webhook_url

    case constants.player_prop_types.GAME_LONGEST_RECEPTION:
      return config.discord_props_open_longest_reception_channel_webhook_url

    // case constants.player_prop_types.GAME_TOUCHDOWNS:

    case constants.player_prop_types.GAME_LONGEST_RUSH:
      return config.discord_props_open_longest_rush_channel_webhook_url

    default:
      return null
  }
}
