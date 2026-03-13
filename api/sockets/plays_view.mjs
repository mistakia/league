import { redis_cache } from '#libs-server'
import get_plays_view_results, {
  get_plays_view_hash
} from '#libs-server/plays-view/get-plays-view-results.mjs'
import debug from 'debug'
import { generate_client_id, send_websocket_message } from './utils.mjs'

const log = debug('plays-view-socket')

class PlaysViewQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.non_auth_requests = new Map()
    log('PlaysViewQueue initialized')
  }

  async add_request({ ws, request_id, params, user_id, ignore_cache = false }) {
    log('Adding request', { request_id, user_id })
    const cache_key = `/plays-views/${get_plays_view_hash(params)}`
    const cached_value = await redis_cache.get(cache_key)

    if (cached_value && !ignore_cache) {
      log('Cache hit', { request_id })
      const result = Array.isArray(cached_value)
        ? cached_value
        : cached_value.plays_view_results
      const metadata = Array.isArray(cached_value)
        ? {}
        : cached_value.plays_view_metadata
      this.send_cached_result({
        ws,
        request_id,
        result,
        metadata,
        append_results: params.append_results,
        source: params.source
      })
    } else {
      if (!user_id) {
        this.handle_non_auth_request({ ws, request_id, params, cache_key })
      } else {
        this.add_to_queue({ ws, request_id, params, user_id, cache_key })
      }
      this.process_queue()
    }
  }

  handle_non_auth_request({ ws, request_id, params, cache_key }) {
    const existing_request = this.non_auth_requests.get(ws.client_id)
    if (existing_request) {
      const queue_index = this.queue.findIndex(
        (item) => item === existing_request
      )
      if (queue_index !== -1) {
        const new_request = {
          ws,
          request_id,
          params,
          user_id: null,
          cache_key,
          position: existing_request.position
        }
        this.queue[queue_index] = new_request
        this.non_auth_requests.set(ws.client_id, new_request)
        this.send_position_update({
          ws: new_request.ws,
          request_id: new_request.request_id,
          position: new_request.position,
          source: params.source
        })
      }
    } else {
      const new_request = { ws, request_id, params, user_id: null, cache_key }
      this.non_auth_requests.set(ws.client_id, new_request)
      this.add_to_queue(new_request)
    }
  }

  add_to_queue(request) {
    const position = this.queue.length + 1
    request.position = position
    this.queue.push(request)
    this.send_position_update({
      ws: request.ws,
      request_id: request.request_id,
      position,
      source: request.params.source
    })
  }

  send_cached_result({
    ws,
    request_id,
    result,
    metadata,
    append_results,
    source
  }) {
    send_websocket_message(ws, 'PLAYS_VIEW_RESULT', {
      request_id,
      result,
      metadata,
      append_results,
      source
    })
  }

  remove_request(client_id) {
    this.queue = this.queue.filter(
      (item) => item.ws.client_id !== client_id || item.user_id
    )
    this.non_auth_requests.delete(client_id)
    this.update_queue_positions()
  }

  send_position_update({ ws, request_id, position, source }) {
    send_websocket_message(ws, 'PLAYS_VIEW_POSITION', {
      request_id,
      position,
      source
    })
  }

  update_queue_positions() {
    this.queue.forEach((item, index) => {
      const new_position = index + 1
      if (item.position !== new_position) {
        item.position = new_position
        this.send_position_update({
          ws: item.ws,
          request_id: item.request_id,
          position: new_position,
          source: item.params.source
        })
      }
    })
  }

  async process_queue() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true
    const { ws, request_id, params, cache_key, user_id } = this.queue.shift()

    try {
      send_websocket_message(ws, 'PLAYS_VIEW_STATUS', {
        request_id,
        status: 'processing',
        source: params.source
      })

      const signed_in_timeout = 5 * 60 * 1000
      const signed_out_timeout = 40 * 1000
      const timeout = user_id ? signed_in_timeout : signed_out_timeout

      const is_pagination_request = params.offset > 0 && params.append_results
      const calculate_total_count = !is_pagination_request

      const { plays_view_results, plays_view_metadata } =
        await get_plays_view_results({
          timeout,
          ...params,
          calculate_total_count
        })

      if (plays_view_results && plays_view_results.length) {
        const cache_ttl =
          plays_view_metadata.cache_ttl || 12 * 60 * 60
        await redis_cache.set(
          cache_key,
          { plays_view_results, plays_view_metadata },
          cache_ttl
        )
      }

      send_websocket_message(ws, 'PLAYS_VIEW_RESULT', {
        request_id,
        result: plays_view_results,
        metadata: plays_view_metadata,
        append_results: params.append_results,
        source: params.source
      })
    } catch (error) {
      log('Error processing request', { request_id, error: error.toString() })
      send_websocket_message(ws, 'PLAYS_VIEW_ERROR', {
        request_id,
        error: error.toString(),
        source: params.source
      })
    } finally {
      this.processing = false
      this.non_auth_requests.delete(ws.client_id)
      this.process_queue()
    }
  }
}

const plays_view_queue = new PlaysViewQueue()

export default function handle_plays_view_socket(wss) {
  wss.on('connection', function (ws, request) {
    const user_id = request.auth ? request.auth.userId : null
    if (!ws.client_id) {
      ws.client_id = generate_client_id()
    }

    ws.on('message', async (msg) => {
      let message
      try {
        message = JSON.parse(msg)
      } catch (error) {
        log('Failed to parse message', { error: error.toString() })
        return
      }

      if (message.type === 'PLAYS_VIEW_REQUEST') {
        const { request_id, params, ignore_cache } = message.payload
        plays_view_queue.add_request({
          ws,
          request_id,
          params,
          user_id,
          ignore_cache
        })
      }
    })

    ws.on('close', () => {
      if (!user_id) {
        plays_view_queue.remove_request(ws.client_id)
      }
    })
  })
}
