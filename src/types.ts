import { os } from "@kksh/api/ui/template"
import * as v from "valibot"

export type Platform = Awaited<ReturnType<typeof os.platform>>
export type Browser = "chrome" | "firefox" | "edge"

export type ChromeBookmark = {
	date_added: string
	date_last_used: string
	guid: string
	id: string
	name: string
	type: "url" | "folder"
	url?: string
	children?: ChromeBookmark[]
	visit_count?: number
}

export const ChromeBookmark: v.GenericSchema<ChromeBookmark> = v.object({
	date_added: v.string(),
	date_last_used: v.string(),
	guid: v.string(),
	id: v.string(),
	name: v.string(),
	type: v.union([v.literal("url"), v.literal("folder")]),
	url: v.optional(v.string()),
	visit_count: v.optional(v.number()),
	children: v.optional(v.array(v.lazy(() => ChromeBookmark)))
})

export const ChromeBookmarksFile = v.object({
	checksum: v.string(),
	version: v.number(),
	sync_metadata: v.string(),
	roots: v.object({
		bookmark_bar: ChromeBookmark,
		other: ChromeBookmark,
		synced: ChromeBookmark
	})
})

export type ChromeBookmarksFile = v.InferOutput<typeof ChromeBookmarksFile>
