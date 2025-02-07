import {
  expose,
  Icon,
  IconEnum,
  List,
  open,
  toast,
  ui,
  TemplateUiCommand
} from "@kksh/api/ui/template"
import { createBookmarkLoader, type Bookmark } from "./bookmark"

function bookmarkToItem(
  bookmark: Bookmark,
  options: { browserIcon: Icon }
): List.Item {
  return new List.Item({
    title: bookmark.name,
    subTitle: bookmark.subtitle,
    value: bookmark.url,
    icon: bookmark.favicon
      ? new Icon({
          type: IconEnum.RemoteUrl,
          value: bookmark.favicon
        })
      : new Icon({
          type: IconEnum.Iconify,
          value: options.browserIcon.value
        }),
    accessories: [
      new List.ItemAccessory({
        icon: new Icon({
          type: IconEnum.Iconify,
          value: options.browserIcon.value
        })
      })
    ]
  })
}

class BrowserBookmark extends TemplateUiCommand {
  async onFormSubmit(value: Record<string, any>): Promise<void> {
    console.log("Form submitted", value)
    toast.success(`Form submitted: ${JSON.stringify(value)}`)
  }
  async load() {
    ui.showLoadingBar(true)
    ui.setSearchBarPlaceholder("Search for bookmarks")
    ui.render(new List.List({}))
    // const platform: Platform = await os.platform()
    const [chromeBookmarks, edgeBookmarks, firefoxBookmarks] =
      await Promise.all([
        createBookmarkLoader("chrome").then((loader) => loader?.load() ?? []),
        createBookmarkLoader("edge").then((loader) => loader?.load() ?? []),
        createBookmarkLoader("firefox").then((loader) => loader?.load() ?? [])
      ])

    const sections: List.Section[] = []

    if (firefoxBookmarks.length > 0) {
      sections.push(
        new List.Section({
          title: "Firefox",
          subtitle: "Firefox",
          items: firefoxBookmarks.map((bookmark) =>
            bookmarkToItem(bookmark, {
              browserIcon: new Icon({
                type: IconEnum.Iconify,
                value: "logos:firefox"
              })
            })
          )
        })
      )
    }

    if (chromeBookmarks.length > 0) {
      sections.push(
        new List.Section({
          title: "Chrome",
          subtitle: "Chrome",
          items: chromeBookmarks.map((bookmark) =>
            bookmarkToItem(bookmark, {
              browserIcon: new Icon({
                type: IconEnum.Iconify,
                value: "logos:chrome"
              })
            })
          )
        })
      )
    }
    if (edgeBookmarks.length > 0) {
      sections.push(
        new List.Section({
          title: "Edge",
          subtitle: "Edge",
          items: edgeBookmarks.map((bookmark) =>
            bookmarkToItem(bookmark, {
              browserIcon: new Icon({
                type: IconEnum.Iconify,
                value: "logos:microsoft-edge"
              })
            })
          )
        })
      )
    }

    return ui
      .setSearchBarPlaceholder("Enter a search term, and press enter to search")
      .then(async () => {
        return ui.render(new List.List({ sections }))
      })
      .finally(() => {
        ui.showLoadingBar(false)
      })
  }

  async onActionSelected(actionValue: string): Promise<void> {
    switch (actionValue) {
      case "open":
        break

      default:
        break
    }
  }

  onSearchTermChange(term: string): Promise<void> {
    return Promise.resolve()
  }

  onListItemSelected(value: string): Promise<void> {
    console.log("Item selected:", value)
    if (value.startsWith("http")) {
      open.url(value)
    }
    return Promise.resolve()
  }
}

expose(new BrowserBookmark())
