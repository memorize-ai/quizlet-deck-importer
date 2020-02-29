import axios from 'axios'
import * as mime from 'mime'
import { v4 as uuid } from 'uuid'

import { ACCOUNT_ID } from './constants'
import { storageUrl } from './helpers'
import admin, { firestore, storage } from './firebase-admin'

const PAGE_DATA_REGEX = /\(function\(\)\{window\.Quizlet\["setPageData"\] = (.+?); QLoad\("Quizlet\.setPageData"\);\}\)\.call\(this\);\(function\(\)\{var script = document\.querySelector\("#.+?"\);script\.parentNode\.removeChild\(script\);\}\)\(\);<\/script>/

interface PageDataTerm {
	id: number
	word: string
	_wordAudioUrl: string
	definition: string
	_definitionAudioUrl: string
	_imageUrl: string | null
}

interface PageData {
	set: {
		title: string
		_thumbnailUrl: string | null
	}
	originalOrder: number[]
	termIdToTermsMap: Record<string, PageDataTerm>
}

export default async (deckId: string, extension: string, topics: string[]) => {
	process.stdout.write('Retrieving page data...')
	const { name, imageUrl, terms } = await getPageData(deckId, extension)
	console.log(' DONE')
	
	process.stdout.write('Importing deck...')
	await importDeck(deckId, topics, name, imageUrl)
	console.log(' DONE')
	
	await importCards(deckId, terms)
	
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
			uploadDeckImage(deckId, imageUrl, error =>
				error
					? console.error(`Error uploading deck image: ${error}`)
					: console.log('Uploaded deck image')
			)
		])
		: createDeck
}

const importCards = (deckId: string, terms: PageDataTerm[]) => {
	
}

const uploadDeckImage = (deckId: string, url: string, completion?: (error?: Error) => void) =>
	uploadAsset(url, () => `decks/${deckId}`, completion)

const uploadAsset = (
	url: string,
	path: (id: string) => string,
	completion?: (error?: Error) => void
) => {
	const contentType = getContentType(url)
	
	if (!contentType)
		throw new Error('Unknown content type')
	
	const token = uuid()
	const rawPath = path(firestore.collection('quizlet-assets').doc().id)
	
	;(async () => { // Immediately return the URL, but upload in the background
		try {
			const { data } = await axios.get(normalizeUrl(url), { responseType: 'blob' })
			
			await storage.file(rawPath).save(data, {
				public: true,
				metadata: {
					contentType,
					owner: ACCOUNT_ID,
					metadata: {
						firebaseStorageDownloadTokens: token
					}
				}
			})
			
			if (completion)
				completion()
		} catch (error) {
			if (completion)
				completion(error)
		}
	})()
	
	return storageUrl(rawPath.split('/'), token)
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
