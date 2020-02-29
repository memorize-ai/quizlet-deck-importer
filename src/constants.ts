import { join } from 'path'

export const DEBUG = false

export const ACCOUNT_ID = DEBUG ? '5xh8ODFbtIfBh7LjA0zGRlpc3kf1' : 's6yreK4ZTRfIjxiYsch0ze1YnR93'

export const DECKS_PATH = join(__dirname, '../products/decks.json')
export const TOPICS_PATH = join(__dirname, '../products/topics.json')

export const FIREBASE_ADMIN_KEY_PATH = join(__dirname, `../protected/firebase-admin${DEBUG ? '-dev' : ''}.json`)

export const ASSET_CHUNK_SIZE = 200
export const MAX_NUMBER_OF_CARDS_IN_SECTION = 50

export const DEFAULT_STORAGE_BUCKET = `memorize-ai${DEBUG ? '-dev' : ''}.appspot.com`
