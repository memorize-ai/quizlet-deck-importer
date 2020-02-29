import { DEFAULT_STORAGE_BUCKET } from './constants'

export const matchAll = (string: string, regex: RegExp) =>
	(string.match(new RegExp(regex, `g${regex.ignoreCase ? 'i' : ''}${regex.multiline ? 'm' : ''}`)) ?? [])
		.map(match => ({
			match,
			captures: match.match(regex)?.slice(1)!
		}))
		.filter(({ captures }) => captures)

export const storageUrl = (pathComponents: string[], token: string) =>
	`https://firebasestorage.googleapis.com/v0/b/${DEFAULT_STORAGE_BUCKET}/o/${pathComponents.join('%2F')}?alt=media&token=${token}`
