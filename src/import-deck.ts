import axios from 'axios'
import * as mime from 'mime'
import { v4 as uuid } from 'uuid'
import Batch from 'firestore-batch'
import { Converter } from 'showdown'

import { ACCOUNT_ID, MAX_NUMBER_OF_CARDS_IN_SECTION } from './constants'
import { storageUrl } from './helpers'
import admin, { firestore, storage } from './firebase-admin'

interface PageDataTerm {
	id: number
	word: string
	definition: string
	_imageUrl: string | null
	_wordAudioUrl: string | null
	_definitionAudioUrl: string | null
}

interface PageData {
	set: {
		title: string
		_thumbnailUrl: string | null
	}
	originalOrder: number[]
	termIdToTermsMap: Record<string, PageDataTerm>
}

const PAGE_DATA_REGEX = /\(function\(\)\{window\.Quizlet\["setPageData"\] = (.+?); QLoad\("Quizlet\.setPageData"\);\}\)\.call\(this\);\(function\(\)\{var script = document\.querySelector\("#.+?"\);script\.parentNode\.removeChild\(script\);\}\)\(\);<\/script>/

const converter = new Converter

const assets: {
	destination: string
	url: string
	contentType: string
	token: string
}[] = []

export default async (deckId: string, extension: string, topics: string[]) => {
	process.stdout.write('Retrieving page data...')
	const { name, imageUrl, terms } = await getPageData(deckId, extension)
	console.log(' DONE')
	
	process.stdout.write('Importing deck...')
	await importDeck(deckId, topics, name, imageUrl)
	console.log(' DONE')
	
	await importCards(deckId, terms)
	
	await uploadAssets()
	
	return deckId
}

const importDeck = async (deckId: string, topics: string[], name: string, imageUrl: string | null) => {
	const createDeck = firestore.doc(`decks/${deckId}`).create({
		topics,
		hasImage: Boolean(imageUrl),
		name,
		subtitle: '',
		description: '',
		viewCount: 0,
		uniqueViewCount: 0,
		ratingCount: 0,
		'1StarRatingCount': 0,
		'2StarRatingCount': 0,
		'3StarRatingCount': 0,
		'4StarRatingCount': 0,
		'5StarRatingCount': 0,
		averageRating: 0,
		downloadCount: 0,
		cardCount: 0,
		unsectionedCardCount: 0,
		currentUserCount: 0,
		allTimeUserCount: 0,
		favoriteCount: 0,
		creator: ACCOUNT_ID,
		created: admin.firestore.FieldValue.serverTimestamp(),
		updated: admin.firestore.FieldValue.serverTimestamp()
	})
	
	return imageUrl
		? Promise.all([
			createDeck,
			getAssetUrl(imageUrl, `decks/${deckId}`)
		])
		: createDeck
}

const importCards = async (deckId: string, terms: PageDataTerm[]) => {
	const cardBatch = new Batch(firestore)
	
	let section: string | undefined
	let nextSectionIndex = 0
	let sectionSize = 0
	
	for (const term of terms) {
		if (!(sectionSize % MAX_NUMBER_OF_CARDS_IN_SECTION)) {
			process.stdout.write(`Creating section #${nextSectionIndex + 1}...`)
			
			section = await createSection(deckId, nextSectionIndex++)
			sectionSize = 0
			
			console.log(' DONE')
		}
		
		cardBatch.set(firestore.collection(`decks/${deckId}/cards`).doc(), {
			section,
			...getCardSides({
				front: term.word,
				back: term.definition,
				imageUrl: term._imageUrl && getAssetUrl(term._imageUrl, id => `deck-assets/${deckId}/${id}`),
				frontAudioUrl: term._wordAudioUrl && getAssetUrl(term._wordAudioUrl, id => `deck-assets/${deckId}/${id}`),
				backAudioUrl: term._definitionAudioUrl && getAssetUrl(term._definitionAudioUrl, id => `deck-assets/${deckId}/${id}`)
			}),
			viewCount: 0,
			reviewCount: 0,
			skipCount: 0
		})
		
		sectionSize++
	}
	
	process.stdout.write(`Importing ${terms.length} cards...`)
	await cardBatch.commit()
	console.log(' DONE')
}

const uploadAssets = () => {
	// TODO: Upload assets
}

const getCardSides = (
	{
		front,
		back,
		imageUrl,
		frontAudioUrl,
		backAudioUrl
	}: {
		front: string,
		back: string,
		imageUrl: string | null,
		frontAudioUrl: string | null,
		backAudioUrl: string | null
	}
) => {
	front = `<h3 style="text-align:center;">${markdownToHtml(front)}</h3>`
	back = `<h3 style="text-align:center;">${markdownToHtml(back)}</h3>`
	
	imageUrl = imageUrl ? `<figure class="image"><img src="${imageUrl}"></figure>` : ''
	frontAudioUrl = frontAudioUrl ? `<audio src="${frontAudioUrl}"></audio>` : ''
	backAudioUrl = backAudioUrl ? `<audio src="${backAudioUrl}"></audio>` : ''
	
	return {
		front: `${frontAudioUrl}${front}`,
		back: `${backAudioUrl}${imageUrl}${back}`
	}
}

const markdownToHtml = (markdown: string) => {
	const html = converter.makeHtml(markdown)
	const match = html.match(/^<p>(.*?)<\/p>$/)
	
	return match ? match[1] : html
}

const getAssetUrl = (url: string, destination: string | ((id: string) => string)) => {
	const contentType = getContentType(url)
	
	if (!contentType)
		throw new Error('Unknown content type')
	
	const token = uuid()
	const rawDestination = typeof destination === 'string'
		? destination
		: destination(firestore.collection('quizlet-assets').doc().id)
	
	assets.push({
		destination: rawDestination,
		url: normalizeUrl(url),
		contentType,
		token
	})
	
	return storageUrl(rawDestination.split('/'), token)
}

const normalizeUrl = (url: string) =>
	url.startsWith('/')
		? `https://quizlet.com${url}`
		: url

const getContentType = (url: string) =>
	mime.getType(url.split('?')[0])

const getPageData = async (deckId: string, extension: string) => {
	const rawPageData: string | undefined = (
		(await axios.get(`https://quizlet.com/${deckId}/${extension}/`)).data.match(PAGE_DATA_REGEX) || []
	)[1]
	
	if (!rawPageData)
		throw new Error(`Unable to get the page data for the deck with ID ${deckId}`)
	
	const {
		set: { title, _thumbnailUrl },
		originalOrder: order,
		termIdToTermsMap: termsMap
	}: PageData = JSON.parse(rawPageData)
	
	return {
		name: title,
		imageUrl: _thumbnailUrl,
		terms: order.map(id => termsMap[id])
	}
}

const createSection = async (deckId: string, index: number) => {
	const ref = firestore.collection(`decks/${deckId}/sections`).doc()
	
	await ref.create({
		name: `Section ${index + 1}`,
		index,
		cardCount: 0
	})
	
	return ref.id
}
