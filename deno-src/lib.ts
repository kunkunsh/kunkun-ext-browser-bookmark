import { Database } from "jsr:@db/sqlite@0.12.0"

export function readFirefoxBookmarks(dbPath: string) {
	const db = new Database(dbPath, { readonly: true })
	const stmt = db.prepare(`
      SELECT mb.title as name, mp.url as url, mp.title as title, mp.description as description, mp.preview_image_url as previewImageUrl
      FROM moz_bookmarks mb
      JOIN moz_places mp ON mb.fk = mp.id
    `)

	const data = stmt.all<{
		name: string
		url: string
		title: string | null
		description: string | null
		previewImageUrl: string | null
	}>()

	db.close()
	return data
}
