import { writeFileSync as writeFile } from 'fs'
import axios from 'axios'

import { TOPICS_PATH, DECKS_PATH } from './constants'
import { matchAll } from './helpers'

const decks: Record<string, {
	imported: boolean
	extension: string
	topics: string[]
}> = require(DECKS_PATH)

export default async (topics: Record<string, string[]> = loadTopics(require(TOPICS_PATH))) => {
	for (const [name, topicIds] of Object.entries(topics)) {
		const html: string = (await axios.get(`https://quizlet.com/subject/${name}/`)).data
		
		const pageCount = parseInt(
			(html.match(/"pagination"\:\{"currentPageNum"\:\d+?\,"numPages"\:(\d+?)\}/) ?? [])[1] ?? '1'
		)
		
		addDecksInHtml(html, topicIds)
		
		const message = `Importing decks for topic "${name}", page `
		
		process.stdout.write(`${message}1/${pageCount}\r`)
		
		for (let page = 2; page <= pageCount; page++) {
			addDecksInHtml(
				(await axios.get(`https://quizlet.com/subject/${name}/?page=${page}`)).data,
				topicIds
			)
			
			process.stdout.write(`${message}${page}/${pageCount}\r`)
		}
		
		delete topics[name]
		
		writeFile(DECKS_PATH, JSON.stringify(decks))
		
		console.log()
	}
	
	return topics
}

const loadTopics = (topics: Record<string, string[]>) => {
	const acc: Record<string, string[]> = {}
	
	for (const name of ([] as string[]).concat(...Object.values(topics)))
		for (const [topicId, names] of Object.entries(topics))
			if (names.includes(name))
				acc[name] = [...acc[name] ?? [], topicId]
	
	return acc
}

const addDeck = (deckId: string, extension: string, topicIds: string[]) => {
	const existingDeck = decks[deckId]
	
	existingDeck
		? existingDeck.topics = [...new Set([...existingDeck.topics, ...topicIds])]
		: decks[deckId] = {
			imported: false,
			extension,
			topics: [...new Set(topicIds)]
		}
}

const addDecksInHtml = (html: string, topicIds: string[]) => {
	const matches = matchAll(
		html,
		/<a.+?class="UILink".+?href="https\:\/\/quizlet\.com\/(\d+?)\/(.+?)\/".*?>.*?<\/a>/
	)
	
	for (const { captures } of matches)
		addDeck(captures[0], captures[1], topicIds)
}

if (require.main === module)
	exports.default().then(console.log).catch(console.error)
