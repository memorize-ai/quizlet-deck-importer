import loadDecks from './load-decks'
import importDecks from './import-decks'
import { sleep } from './helpers'

const main = async (): Promise<void> => {
	try {
		await loadDecks()
		await importDecks()
		
		await sleep(1000 * 60 * 60)
	} catch (error) {
		console.error(error)
	}
	
	return main()
}

export default main

if (require.main === module)
	main()
