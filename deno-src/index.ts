import { expose } from "@kunkun/api/runtime/deno"
import { readFirefoxBookmarks } from "./lib.ts"

expose({
	readFirefoxBookmarks
})
// console.log(
// 	readFirefoxBookmarks(
// 		"/Users/hacker/Library/Application Support/Firefox/Profiles/czahqvgw.default-release/places.sqlite"
// 	)
// )

// deno run --allow-env=DENO_SQLITE_PATH,DENO_SQLITE_LOCAL,DENO_DIR,HOME --allow-read=/Users/hacker/Library/Caches/deno/plug --allow-ffi index.ts
