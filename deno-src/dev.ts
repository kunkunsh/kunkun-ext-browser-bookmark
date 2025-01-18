import { readFirefoxBookmarks } from "./lib.ts"

const dbPath =
	"/Users/hacker/Library/Application Support/Firefox/Profiles/czahqvgw.default-release/places.sqlite"

const data = readFirefoxBookmarks(dbPath)
console.log(data)
