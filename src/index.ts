import loadDecks from './load-decks'
import importDecks from './import-decks'
import { sleep } from './helpers'

const main = async (load: string = 'true'): Promise<void> => {
	try {
		if (load === 'true')
			await loadDecks()
		
		await importDecks()
		
		console.log('Sleeping for one hour...')
		await sleep(1000 * 60 * 60)
	} catch (error) {
		console.error(error)
	}
	
	return main()
}

export default main

if (require.main === module)
	main(process.argv.length > 3 ? process.argv[2] : undefined)
