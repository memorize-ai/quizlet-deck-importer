import { writeFileSync as writeFile } from 'fs'
import * as chalk from 'chalk'

import importDeck from './import-deck'
import { DECKS_PATH } from './constants'

const decks: Record<string, {
	imported: boolean
	extension: string
	topics: string[]
}> = require(DECKS_PATH)

export default async () => {
	for (const [deckId, deckData] of Object.entries(decks)) {
		if (deckData.imported)
			continue
		
		console.log(chalk`{yellow Importing deck with ID} {yellow.bold ${deckId}}{yellow ...}`)
		
		try {
			await importDeck(deckId, deckData.extension, deckData.topics)
		} catch (error) {
			console.error(`Error importing deck with ID ${deckId}: ${error}`)
			switch (error.code) {
				case 'deck-already-exists':
					console.log('The deck already exists, marking it as imported...')
					break
				case 'page-data-unavailable':
					console.log('Moving on to the next deck...')
					continue
				case 'page-data-bad-request':
					console.log('This set does not exist or some other error occurred when fetching the page data. Marking it as imported...')
					break
				default:
					console.log('An unknown error occurred, moving on the the next deck...')
					continue
			}
		}
		
		deckData.imported = true
		
		writeFile(DECKS_PATH, JSON.stringify(decks))
		
		console.log(chalk`{green Imported deck with ID} {green.bold ${deckId}}`)
	}
}

if (require.main === module)
	exports.default().catch(console.error)
