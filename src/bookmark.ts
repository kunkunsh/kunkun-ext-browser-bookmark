import { fs, os, path, shell, toast } from "@kksh/api/ui/worker"
import * as v from "valibot"
import { ChromeBookmarksFile } from "./types"
import type { Browser, ChromeBookmark, Platform } from "./types"

// given a url, compute it's favicon
function getFavicon(url: string): string | undefined {
	if (!url.startsWith("http")) {
		return undefined
	}
	try {
		const urlObj = new URL(url)
		const faviconUrl = `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`
		return faviconUrl
	} catch (error) {
		console.error("Failed to parse URL:", error)
		return undefined
	}
}

export const FirefoxBookmark = v.object({
	name: v.string(),
	url: v.string(),
	title: v.nullable(v.string()),
	description: v.nullable(v.string()),
	previewImageUrl: v.nullable(v.string())
})

export type FirefoxBookmark = v.InferOutput<typeof FirefoxBookmark>
export const FirefoxBookmarkList = v.array(FirefoxBookmark)
export type FirefoxBookmarkList = v.InferOutput<typeof FirefoxBookmarkList>

export type Bookmark = {
	name: string
	subtitle?: string
	url: string
	visitCount?: number
	favicon?: string
}

export abstract class IBrowserBookmarks {
	protected bookmarkPath: string

	constructor(bookmarkPath: string) {
		this.bookmarkPath = bookmarkPath
	}
	abstract load(): Promise<Bookmark[]>

	getBookmarkPath(): string {
		return this.bookmarkPath
	}
}

async function flattenChromeBookmarkTree(bookmarkTree: ChromeBookmark): Promise<Bookmark[]> {
	const bookmarks: Bookmark[] = []

	if (bookmarkTree.type === "folder") {
		for (const child of bookmarkTree.children || []) {
			bookmarks.push(...(await flattenChromeBookmarkTree(child)))
		}
	} else if (bookmarkTree.type === "url" && bookmarkTree.url) {
		bookmarks.push({
			name: bookmarkTree.name,
			subtitle: bookmarkTree.name.trim().length === 0 ? bookmarkTree.url : undefined,
			url: bookmarkTree.url,
			visitCount: bookmarkTree.visit_count ?? 0,
			favicon: await getFavicon(bookmarkTree.url)
		})
	}
	return bookmarks
}

export class ChromeBookmarks extends IBrowserBookmarks {
	async load(): Promise<Bookmark[]> {
		return fs
			.readTextFile(this.bookmarkPath)
			.then(async (content) => {
				try {
					const jsonParsed = JSON.parse(content)
					const parseResult = v.safeParse(ChromeBookmarksFile, jsonParsed)
					if (!parseResult.success) {
						throw new Error(`Failed to parse bookmark file: ${v.flatten(parseResult.issues)}`)
					}
					return [
						...(await flattenChromeBookmarkTree(parseResult.output.roots.bookmark_bar)),
						...(await flattenChromeBookmarkTree(parseResult.output.roots.other)),
						...(await flattenChromeBookmarkTree(parseResult.output.roots.synced))
					]
						.flat()
						.filter((b) => b.url || b.name)
						.sort((a, b) => (b.visitCount ?? 0) - (a.visitCount ?? 0))
				} catch (error) {
					toast.error(`Failed to parse bookmark file`, { description: this.bookmarkPath })
					throw new Error(`Failed to parse bookmark file: ${error}`)
				}
			})
			.catch((err) => {
				toast.error(`Failed to read bookmarks`, { description: err.message })
				return []
			})
	}
}

export class FirefoxBookmarks extends IBrowserBookmarks {
	async load(): Promise<Bookmark[]> {
		const allowRead = await path.join(await path.homeDir(), "Library/Caches/deno/plug")
		const { rpcChannel, process, command } = await shell.createDenoRpcChannel<
			{},
			{
				readFirefoxBookmarks: (dbPath: string) => FirefoxBookmarkList
			}
		>(
			"$EXTENSION/deno-src/index.ts",
			[],
			{
				allowRead: [allowRead],
				allowEnv: ["DENO_SQLITE_PATH", "DENO_SQLITE_LOCAL", "DENO_DIR", "HOME"],
				allowAllFfi: true
				// allowNet: ["http://**", "https://**"]
			},
			{}
		)
		command.stderr.on("data", (data) => {
			console.error(data.toString())
		})
		const api = rpcChannel.getAPI()
		let bookmarks: Bookmark[] = []
		try {
			const rawFFBookmarks = await api.readFirefoxBookmarks(this.bookmarkPath)
			const parseResult = v.safeParse(FirefoxBookmarkList, rawFFBookmarks)
			if (!parseResult.success) {
				toast.error(`Failed to parse firefox bookmarks`)
				return []
			}
			bookmarks = parseResult.output.map((b) => ({
				name: b.name,
				subtitle: b.title ?? undefined,
				url: b.url,
				favicon: getFavicon(b.url)
			}))
		} catch (error) {
		} finally {
			process.kill()
		}
		return bookmarks
	}
}

async function getChromeBookmarksPath(): Promise<string | null> {
	const platform: Platform = await os.platform()
	let bookmarkPath = null
	if (platform === "macos") {
		bookmarkPath = await path.join(
			await path.homeDir(),
			"Library/Application Support/Google/Chrome/Default/Bookmarks"
		)
	} else if (platform === "linux") {
		bookmarkPath = await path.join(await path.homeDir(), ".config/google-chrome/Default/Bookmarks")
	} else if (platform === "windows") {
		bookmarkPath = await path.join(
			await path.homeDir(),
			"AppData/Local/Google/Chrome/User Data/Default/Bookmarks"
		)
	}
	if (bookmarkPath && (await fs.exists(bookmarkPath))) {
		return bookmarkPath
	} else {
		return null
	}
}

async function getEdgeBookmarksPath(): Promise<string | null> {
	const platform: Platform = await os.platform()
	let bookmarkPath = null
	if (platform === "macos") {
		bookmarkPath = await path.join(
			await path.homeDir(),
			"Library/Application Support/Microsoft Edge/Default/Bookmarks"
		)
	} else if (platform === "linux") {
		bookmarkPath = await path.join(
			await path.homeDir(),
			".config/microsoft-edge-dev/Default/Bookmarks"
		)
	} else if (platform === "windows") {
		bookmarkPath = await path.join(
			await path.homeDir(),
			"AppData/Local/Microsoft/Edge/User Data/Default/Bookmarks"
		)
	}
	if (bookmarkPath && (await fs.exists(bookmarkPath))) {
		return bookmarkPath
	} else {
		return null
	}
}

async function getFirefoxBookmarksPath(): Promise<string | null> {
	const platform: Platform = await os.platform()
	let bookmarkPath = null
	if (platform === "macos") {
		const firefoxProfilesDir = await path.join(
			await path.homeDir(),
			"Library/Application Support/Firefox/Profiles"
		)
		if (!(await fs.exists(firefoxProfilesDir))) {
			return null
		}
		const firefoxProfiles = await fs.readDir(firefoxProfilesDir)
		console.log("firefoxProfiles", firefoxProfiles)
		const defaultReleaseDir = firefoxProfiles.find((dir) => dir.name.includes("default-release"))
		if (!defaultReleaseDir) return null
		bookmarkPath = await path.join(firefoxProfilesDir, defaultReleaseDir.name, "places.sqlite")
		if (!(await fs.exists(bookmarkPath))) {
			console.warn("firefox bookmark DB not exists", bookmarkPath)
			return null
		}
		return bookmarkPath
	} else if (platform === "linux") {
		bookmarkPath = await path.join(
			await path.homeDir(),
			"snap/firefox/common/.mozilla/firefox/vuolckoc.default/places.sqlite"
		)
	} else if (platform === "windows") {
		bookmarkPath = await path.join(
			await path.homeDir(),
			"AppData/Roaming/Mozilla/Firefox/Profiles/"
		)
	}
	if (bookmarkPath && (await fs.exists(bookmarkPath))) {
		return bookmarkPath
	} else {
		return null
	}
}

export async function createBookmarkLoader(browser: Browser): Promise<IBrowserBookmarks | null> {
	switch (browser) {
		case "chrome":
			const chromeBookmarkPath = await getChromeBookmarksPath()
			if (chromeBookmarkPath) {
				return new ChromeBookmarks(chromeBookmarkPath)
			}
			break
		case "edge":
			const edgeBookmarkPath = await getEdgeBookmarksPath()
			if (edgeBookmarkPath) {
				return new ChromeBookmarks(edgeBookmarkPath)
			}
			break
		case "firefox":
			const firefoxSqlitePath = await getFirefoxBookmarksPath()
			if (firefoxSqlitePath) {
				return new FirefoxBookmarks(firefoxSqlitePath)
			}
			break

		default:
			break
	}

	return null
}
