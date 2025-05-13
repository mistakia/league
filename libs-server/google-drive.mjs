import fs from 'fs'
import fsPromises from 'fs/promises'
import { google } from 'googleapis'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { authenticate } from '@google-cloud/local-auth'

const __dirname = dirname(fileURLToPath(import.meta.url))

// If modifying these scopes, delete token.json.
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata'
]
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'drive-token.json'
const CREDENTIALS_PATH = path.resolve(
  __dirname,
  '../',
  'drive-credentials.json'
)

/**
 * Reads previously authorized credentials from the save file.
 */
async function load_saved_credentials_if_exist() {
  try {
    const content = await fsPromises.readFile(TOKEN_PATH)
    const credentials = JSON.parse(content)
    return google.auth.fromJSON(credentials)
  } catch (err) {
    return null
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 */
async function save_credentials(client) {
  const content = await fsPromises.readFile(CREDENTIALS_PATH)
  const keys = JSON.parse(content)
  const key = keys.installed || keys.web
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token
  })
  await fsPromises.writeFile(TOKEN_PATH, payload)
}

/**
 * Load or request authorization to call APIs.
 */
async function authorize() {
  let client = await load_saved_credentials_if_exist()
  if (client) {
    return client
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH
  })
  if (client.credentials) {
    await save_credentials(client)
  }
  return client
}

export default async function () {
  const auth = await authorize()
  return google.drive({
    version: 'v3',
    auth
  })
}

export const downloadFile = ({ drive, file }) =>
  new Promise((resolve, reject) => {
    const filename = file.name
    const dest = fs.createWriteStream(`./${filename}`)
    console.log('downloading', filename)

    drive.files.get(
      {
        fileId: file.id,
        alt: 'media'
      },
      {
        responseType: 'stream'
      },
      (err, res) => {
        if (err) {
          return reject(err)
        }

        res.data
          .on('end', function () {
            console.log('download complete', filename)
            resolve(filename)
          })
          .on('error', function (err) {
            console.log(err)
          })
          .pipe(dest)
      }
    )
  })
