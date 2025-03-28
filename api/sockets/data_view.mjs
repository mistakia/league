import { get_data_view_results, redis_cache } from '#libs-server'
import get_data_view_hash from '#libs-server/data-views/get-data-view-hash.mjs'
import debug from 'debug'

const log = debug('data-view-socket')

class DataViewQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.non_auth_requests = new Map()
    log('DataViewQueue initialized')
  }

  async add_request({ ws, request_id, params, user_id, ignore_cache = false }) {
    log('Adding request', { request_id, user_id })
    const cache_key = `/data-views/${get_data_view_hash(params)}`
    const cached_value = await redis_cache.get(cache_key)

    if (cached_value && !ignore_cache) {
      log('Cache hit', { request_id })
      this.send_cached_result({
        ws,
        request_id,
        result: cached_value.data_view_results,
        metadata: cached_value.data_view_metadata,
        append_results: params.append_results
      })
    } else {
      if (ignore_cache) {
        log('Ignoring cache', { request_id })
      } else {
        log('Cache miss', { request_id })
      }
      if (!user_id) {
        this.handle_non_auth_request({ ws, request_id, params, cache_key })
      } else {
        this.add_to_queue({ ws, request_id, params, user_id, cache_key })
      }
      this.process_queue()
    }
  }

  handle_non_auth_request({ ws, request_id, params, cache_key }) {
    log('Handling non-auth request', { request_id })
    const existing_request = this.non_auth_requests.get(ws.client_id)
    if (existing_request) {
      // Update the existing request in the queue
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
          position: new_request.position
        })
      }
    } else {
      // Add new request to the queue
      const new_request = { ws, request_id, params, user_id: null, cache_key }
      this.non_auth_requests.set(ws.client_id, new_request)
      this.add_to_queue(new_request)
    }
  }

  add_to_queue(request) {
    const position = this.queue.length + 1
    request.position = position
    this.queue.push(request)
    log('Added to queue', { request_id: request.request_id, position })
    this.send_position_update({
      ws: request.ws,
      request_id: request.request_id,
      position
    })
  }

  send_cached_result({ ws, request_id, result, metadata, append_results }) {
    ws.send(
      JSON.stringify({
        type: 'DATA_VIEW_RESULT',
        payload: { request_id, result, metadata, append_results }
      })
    )
  }

  remove_request(client_id) {
    log('Removing request', { client_id })
    this.queue = this.queue.filter(
      (item) => item.ws.client_id !== client_id || item.user_id
    )
    this.non_auth_requests.delete(client_id)
    this.update_queue_positions()
  }

  send_position_update({ ws, request_id, position }) {
    ws.send(
      JSON.stringify({
        type: 'DATA_VIEW_POSITION',
        payload: { request_id, position }
      })
    )
  }

  update_queue_positions() {
    this.queue.forEach((item, index) => {
      const new_position = index + 1
      if (item.position !== new_position) {
        item.position = new_position
        this.send_position_update({
          ws: item.ws,
          request_id: item.request_id,
          position: new_position
        })
      }
    })
  }

  async process_queue() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true
    const { ws, request_id, params, cache_key, user_id } = this.queue.shift()
    log('Processing request', { request_id, user_id })

    try {
      this.send_message_to_client({
        ws,
        type: 'DATA_VIEW_STATUS',
        payload: { request_id, status: 'processing' }
      })

      const signed_in_timeout = 5 * 60 * 1000 // 5 minutes
      const signed_out_timeout = 40 * 1000 // 40 seconds
      const timeout = user_id ? signed_in_timeout : signed_out_timeout

      // Only calculate total count on initial requests (not pagination)
      const is_pagination_request = params.offset > 0 && params.append_results
      const calculate_total_count = !is_pagination_request

      const { data_view_results, data_view_metadata } =
        await get_data_view_results({
          timeout,
          ...params,
          calculate_total_count
        })

      if (data_view_results && data_view_results.length) {
        const cache_ttl = data_view_metadata.cache_ttl || 1000 * 60 * 60 * 12 // 12 hours
        await redis_cache.set(
          cache_key,
          {
            data_view_results,
            data_view_metadata
          },
          cache_ttl
        )

        if (data_view_metadata.cache_expire_at) {
          await redis_cache.expire_at(
            cache_key,
            data_view_metadata.cache_expire_at
          )
        }
      }

      this.send_message_to_client({
        ws,
        type: 'DATA_VIEW_RESULT',
        payload: {
          request_id,
          result: data_view_results,
          metadata: data_view_metadata,
          append_results: params.append_results
        }
      })
      log('Request processed successfully', { request_id })
    } catch (error) {
      log('Error processing request', { request_id, error: error.toString() })
      this.send_message_to_client({
        ws,
        type: 'DATA_VIEW_ERROR',
        payload: { request_id, error: error.toString() }
      })
    } finally {
      this.processing = false
      this.non_auth_requests.delete(ws.client_id)
      this.process_queue()
    }
  }

  send_message_to_client({ ws, type, payload }) {
    ws.send(JSON.stringify({ type, payload }))
  }
}

const data_view_queue = new DataViewQueue()

export default function handle_data_view_socket(wss) {
  wss.on('connection', function (ws, request) {
    const user_id = request.auth ? request.auth.userId : null
    ws.client_id = Math.random().toString(36).substr(2, 9) // Generate a unique client ID
    log('New WebSocket connection', { client_id: ws.client_id, user_id })

    ws.on('message', async (msg) => {
      const message = JSON.parse(msg)

      if (message.type === 'DATA_VIEW_REQUEST') {
        const { request_id, params, ignore_cache } = message.payload
        log('Received DATA_VIEW_REQUEST', { request_id, user_id })
        data_view_queue.add_request({
          ws,
          request_id,
          params,
          user_id,
          ignore_cache
        })
      }
    })

    ws.on('close', () => {
      log('WebSocket connection closed', { client_id: ws.client_id, user_id })
      if (!user_id) {
        data_view_queue.remove_request(ws.client_id)
      }
    })
  })
}
