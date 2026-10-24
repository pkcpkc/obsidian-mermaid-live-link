# TODO

## Before first publish

- [x] Decide git identity for this repo: global config is already paul.hackenberger@gmail.com
- [x] Add `authorUrl` to `manifest.json` (https://github.com/pkcpkc)
- [x] Confirm the name is free: "Mermaid Kit" was taken (paddychenc75/obsidian-mermaid-kit), renamed to "Mermaid Live Link" (`mermaid-live-link`)
- [x] Rename the local folder / GitHub repo to `obsidian-mermaid-live-link`
- [x] Keep the mermaid.live link hidden in print/PDF export (see `styles.css`)
- [ ] Test the repo copy in a vault (only the vault copy has been tested so far): Live Preview, Reading view, PDF export
  - Install into `<vault>/.obsidian/plugins/mermaid-live-link/` and remove the old `mermaid-kit` folder
  - Also check diagrams in callouts, nested callouts, lists and embedded notes (`![[note]]`; embeds only get a link when the embedded note has exactly one diagram), and that the link switches to the dark theme
  - Live Preview now uses a ViewPlugin: check the link appears on open, after scrolling, and that its URL updates after editing the diagram
- [x] Add a screenshot or GIF to the README
- [x] Make the first commit, create the GitHub repo (public), add remote, push

## Release

- [x] Tag `1.0.0` (must equal the `manifest.json` version, no leading `v`) and push it; check the GitHub Action attaches `main.js`, `manifest.json`, `styles.css`
- [ ] Optionally announce via BRAT first and test installing from the repo

## Community plugin submission

- [x] Fork `obsidianmd/obsidian-releases`
- [x] Add an entry to `community-plugins.json` (`id`, `name`, `author`, `description`, `repo`)
- [ ] Open the pull request and address review feedback (can take weeks)

## Likely review points / code improvements

- [x] Replace the 1 s polling in `decorateLivePreview` with a CodeMirror 6 `ViewPlugin` / `MutationObserver`
- [x] Avoid the undocumented `view.editor.cm` access (the ViewPlugin gets the `EditorView` directly)
- [ ] Consider a build step (TypeScript + esbuild) if the plugin grows (skipped for now: plain JS is small enough)
- [x] Handle diagrams inside callouts, lists and embedded notes (check `fenceAt` and `getSectionInfo` there)
- [x] Respect the dark theme in the mermaid.live payload (currently always `default`)

## Ideas

- [ ] Setting to turn off the "page break before a headline followed by a diagram" print rule (opinionated)
- [ ] Settings tab: link text, theme sent to mermaid.live, max diagram width, hide link in print
- [ ] Optional "Copy mermaid.live link" command
- [ ] Optional "Export diagram as PNG/SVG" action
