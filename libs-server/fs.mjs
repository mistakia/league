import * as fs_promises from 'node:fs/promises'
import * as fs_sync from 'node:fs'
import { dirname } from 'node:path'

const ensure_dir = (path) => fs_promises.mkdir(path, { recursive: true })

const ensure_file = async (path) => {
  await fs_promises.mkdir(dirname(path), { recursive: true })
  const handle = await fs_promises.open(path, 'a')
  await handle.close()
}

const path_exists = (path) =>
  fs_promises.access(path).then(
    () => true,
    () => false
  )

const read_json = async (path) =>
  JSON.parse(await fs_promises.readFile(path, 'utf8'))

const read_json_sync = (path) =>
  JSON.parse(fs_sync.readFileSync(path, 'utf8'))

const write_json = (path, data, { spaces } = {}) =>
  fs_promises.writeFile(path, JSON.stringify(data, null, spaces))

const write_json_sync = (path, data, { spaces } = {}) =>
  fs_sync.writeFileSync(path, JSON.stringify(data, null, spaces))

const remove = (path) =>
  fs_promises.rm(path, { recursive: true, force: true })

const copy = (src, dst) => fs_promises.cp(src, dst, { recursive: true })

const move = (src, dst) => fs_promises.rename(src, dst)

const empty_dir = async (path) => {
  await fs_promises.rm(path, { recursive: true, force: true })
  await fs_promises.mkdir(path, { recursive: true })
}

const output_file = async (path, data, options) => {
  await fs_promises.mkdir(dirname(path), { recursive: true })
  return fs_promises.writeFile(path, data, options)
}

const output_json = async (path, data, { spaces } = {}) => {
  await fs_promises.mkdir(dirname(path), { recursive: true })
  return fs_promises.writeFile(path, JSON.stringify(data, null, spaces))
}

export default {
  ...fs_promises,
  existsSync: fs_sync.existsSync,
  readFileSync: fs_sync.readFileSync,
  writeFileSync: fs_sync.writeFileSync,
  mkdirSync: fs_sync.mkdirSync,
  constants: fs_sync.constants,
  ensureDir: ensure_dir,
  ensureFile: ensure_file,
  pathExists: path_exists,
  readJson: read_json,
  readJSON: read_json,
  readJsonSync: read_json_sync,
  writeJson: write_json,
  writeJSON: write_json,
  writeJsonSync: write_json_sync,
  remove,
  copy,
  move,
  emptyDir: empty_dir,
  outputFile: output_file,
  outputJson: output_json
}
