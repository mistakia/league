import { get_data_view_results, data_view_cache } from '#libs-server'
import get_table_hash from '#libs-server/get-table-hash.mjs'

class DataViewQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.non_auth_requests = new Map()
  }

  async add_request({ ws, request_id, params, user_id }) {
    const cache_key = get_table_hash(JSON.stringify(params))
    const cached_result = await data_view_cache.get(cache_key)

    if (cached_result) {
      this.send_cached_result({ ws, request_id, result: cached_result })
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
    const existing_request = this.non_auth_requests.get(ws)
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
        this.non_auth_requests.set(ws, new_request)
        this.send_position_update({
          ws: new_request.ws,
          request_id: new_request.request_id,
          position: new_request.position
        })
      }
    } else {
      // Add new request to the queue
      const new_request = { ws, request_id, params, user_id: null, cache_key }
      this.non_auth_requests.set(ws, new_request)
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
      position
    })
  }

  send_cached_result({ ws, request_id, result }) {
    ws.send(
      JSON.stringify({
        type: 'DATA_VIEW_RESULT',
        payload: { request_id, result }
      })
    )
  }

  remove_request(ws) {
    this.queue = this.queue.filter((item) => item.ws !== ws || item.user_id)
    this.non_auth_requests.delete(ws)
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

    try {
      ws.send(
        JSON.stringify({
          type: 'DATA_VIEW_STATUS',
          payload: { request_id, status: 'processing' }
        })
      )

      const signed_in_timeout = 5 * 60 * 1000 // 5 minutes
      const signed_out_timeout = 40 * 1000 // 40 seconds
      const timeout = user_id ? signed_in_timeout : signed_out_timeout
      const result = await get_data_view_results({ timeout, ...params })

      if (result && result.length) {
        const cache_ttl = 1000 * 60 * 60 * 12 // 12 hours
        await data_view_cache.set(cache_key, result, cache_ttl)
      }

      ws.send(
        JSON.stringify({
          type: 'DATA_VIEW_RESULT',
          payload: { request_id, result }
        })
      )
    } catch (error) {
      ws.send(
        JSON.stringify({
          type: 'DATA_VIEW_ERROR',
          payload: { request_id, error: error.toString() }
        })
      )
    } finally {
      this.processing = false
      if (!this.non_auth_requests.get(ws)) {
        this.non_auth_requests.delete(ws)
      }
      this.process_queue()
    }
  }
}

const data_view_queue = new DataViewQueue()

export default function handle_data_view_socket(wss) {
  wss.on('connection', function (ws, request) {
    const user_id = request.auth ? request.auth.userId : null

    ws.on('message', async (msg) => {
      const message = JSON.parse(msg)

      if (message.type === 'DATA_VIEW_REQUEST') {
        const { request_id, params } = message.payload
        data_view_queue.add_request({ ws, request_id, params, user_id })
      }
    })

    ws.on('close', () => {
      if (!user_id) {
        data_view_queue.remove_request(ws)
      }
    })
  })
}
