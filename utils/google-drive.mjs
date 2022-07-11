import fs from 'fs'
import fsPromises from 'fs/promises'
import { google } from 'googleapis'
import readline from 'readline'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// If modifying these scopes, delete token.json.
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
]
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'drive-token.json'

// Create an OAuth2 client with the given credentials, and then execute the
// given callback function.
async function authorize(credentials) {
  const { client_secret, client_id, redirect_uris } = credentials.installed
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  )

  // Check if we have previously stored a token.
  try {
    const token = await fsPromises.readFile(TOKEN_PATH)
    oAuth2Client.setCredentials(JSON.parse(token))
    return oAuth2Client
  } catch (err) {
    return getAccessToken(oAuth2Client)
  }
}

// Get and store new token after prompting for user authorization, and then
// execute the given callback with the authorized OAuth2 client.
function getAccessToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    })
    console.log('Authorize this app by visiting this url:', authUrl)
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close()
      oAuth2Client.getToken(code, (err, token) => {
        if (err) {
          console.error('Error retrieving access token', err)
          return reject(err)
        }

        oAuth2Client.setCredentials(token)
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) console.error(err)
          console.log('Token stored to', TOKEN_PATH)
        })
        resolve(oAuth2Client)
      })
    })
  })
}

export default async function () {
  // Load client secrets from a local file.
  const content = await fsPromises.readFile(
    path.resolve(__dirname, '../', 'drive-credentials.json')
  )
  const auth = await authorize(JSON.parse(content))
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
