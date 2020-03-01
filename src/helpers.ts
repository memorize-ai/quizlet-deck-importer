import { DEFAULT_STORAGE_BUCKET } from './constants'

export const errorWithCode = (message: string, code: string) => {
	const error = new Error(message)
	;(error as any).code = code
	return error
}

export interface Match {
	match: string
	captures: string[]
}

export const matchAll = (string: string, regex: RegExp) =>
	(string.match(new RegExp(regex, `g${regex.ignoreCase ? 'i' : ''}${regex.multiline ? 'm' : ''}`)) ?? [])
		.reduce((acc, match) => {
			const transform = {
				match,
				captures: match.match(regex)?.slice(1)
			}
			return transform.captures
				? [...acc, transform as any]
				: acc
		}, [] as Match[])

export const storageUrl = (pathComponents: string[], token: string) =>
	`https://firebasestorage.googleapis.com/v0/b/${DEFAULT_STORAGE_BUCKET}/o/${pathComponents.join('%2F')}?alt=media&token=${token}`
