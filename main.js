const { Plugin, TFile } = require('obsidian');
const { ViewPlugin } = require('@codemirror/view');

// Code behind each link, so hrefs can be rebuilt when the theme changes.
const linkCode = new WeakMap();

function currentTheme() {
  return document.body.classList.contains('theme-dark') ? 'dark' : 'default';
}

function buildHref(rawCode) {
  const config = JSON.stringify({ theme: currentTheme() }, null, 2);
  const payload = { code: rawCode, mermaid: config, autoSync: true, updateDiagram: true };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return `https://mermaid.live/edit#base64:${encoded}`;
}

function buildLink(rawCode) {
  const linkDiv = createDiv({ cls: 'mermaid-live-link' });
  const a = linkDiv.createEl('a', {
    text: 'Edit in mermaid.live ↗',
    href: buildHref(rawCode),
    attr: { target: '_blank', rel: 'noopener' },
  });
  linkCode.set(a, rawCode);
  return linkDiv;
}

function setLinkCode(a, rawCode) {
  linkCode.set(a, rawCode);
  const href = buildHref(rawCode);
  if (a.getAttribute('href') !== href) a.setAttribute('href', href);
}

// Adds the link to `container`, or keeps an existing one in sync with `rawCode`.
function appendLink(container, rawCode) {
  const existing = container.querySelector(':scope > .mermaid-live-link a');
  if (existing) setLinkCode(existing, rawCode);
  else container.appendChild(buildLink(rawCode));
}

// Adds the link right after a rendered `.mermaid` diagram.
function linkAfter(diagram, rawCode) {
  const next = diagram.nextElementSibling;
  if (next && next.classList.contains('mermaid-live-link')) setLinkCode(next.querySelector('a'), rawCode);
  else diagram.after(buildLink(rawCode));
}

const FENCE_OPEN = /^((?:\s*>)*)(\s*)(`{3,}|~{3,})\s*([^\s`]*)/;

// Removes `depth` callout/blockquote markers (`>`) from a line; null if it has fewer.
function unquote(line, depth) {
  for (let i = 0; i < depth; i++) {
    const m = /^\s*> ?/.exec(line);
    if (!m) return null;
    line = line.slice(m[0].length);
  }
  return line;
}

// Every mermaid fenced block in `lines` as { start, end, code } (0-based line indices).
// Handles blocks nested in callouts/blockquotes (`>` prefixes) and lists (indentation).
function mermaidFences(lines) {
  const fences = [];
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE_OPEN.exec(lines[i]);
    if (!open) continue;
    const [, quotes, , marker, lang] = open;
    const depth = (quotes.match(/>/g) || []).length;
    const indent = /^\s*/.exec(unquote(lines[i], depth))[0];
    const close = new RegExp(`^\\s*${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`);
    const body = [];
    let end = i + 1;
    for (; end < lines.length; end++) {
      const line = unquote(lines[end], depth);
      if (line === null || close.test(line)) break; // left the callout, or closing fence
      body.push(line.startsWith(indent) ? line.slice(indent.length) : line.trimStart());
    }
    if (lang.toLowerCase() === 'mermaid') fences.push({ start: i, end, code: body.join('\n').trim() });
    i = end;
  }
  return fences;
}

// Links the `.mermaid` diagrams inside `container` to `fences`, in document order.
// Diagrams render asynchronously, so keep watching until all have appeared.
function linkWhenRendered(container, fences) {
  const attach = () => {
    const diagrams = container.querySelectorAll('.mermaid');
    diagrams.forEach((diagram, i) => {
      if (fences[i] && fences[i].code) linkAfter(diagram, fences[i].code);
    });
    return diagrams.length >= fences.length;
  };
  if (attach()) return;
  const observer = new MutationObserver(() => {
    if (attach()) observer.disconnect();
  });
  observer.observe(container, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 10000);
}

// Live Preview: diagrams are CodeMirror widgets that post-processors never see.
// Obsidian renders them asynchronously, so a MutationObserver catches them once they
// appear. Work is deferred to the next frame because plugin updates run before
// CodeMirror has updated its DOM.
const livePreviewLinks = ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view;
    this.frame = 0;
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(view.contentDOM, { childList: true, subtree: true });
    this.schedule();
  }

  update(update) {
    if (update.docChanged || update.viewportChanged) this.schedule();
  }

  schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.decorate();
    });
  }

  decorate() {
    const blocks = this.view.contentDOM.querySelectorAll('.cm-preview-code-block.cm-lang-mermaid');
    const callouts = this.view.contentDOM.querySelectorAll('.cm-callout');
    if (!blocks.length && !callouts.length) return;
    const doc = this.view.state.doc;
    const lines = doc.toString().split('\n');
    const fences = mermaidFences(lines);
    if (!fences.length) return;
    const lineOf = (el) => doc.lineAt(this.view.posAtDOM(el)).number - 1;

    // Widgets can outlive edits to their code, so existing links are kept in sync.
    blocks.forEach((widget) => {
      try {
        const lineIdx = lineOf(widget);
        const fence = fences.find((f) => f.start <= lineIdx && lineIdx <= f.end);
        if (fence && fence.code) appendLink(widget, fence.code);
      } catch (err) {
        console.error('Mermaid Live Link:', err);
      }
    });

    // A callout is a single widget holding its rendered contents.
    callouts.forEach((callout) => {
      try {
        const start = lineOf(callout);
        let end = start;
        while (end + 1 < lines.length && /^\s*>/.test(lines[end + 1])) end++;
        const inside = fences.filter((f) => f.start >= start && f.start <= end);
        callout.querySelectorAll('.mermaid').forEach((diagram, i) => {
          if (inside[i] && inside[i].code) linkAfter(diagram, inside[i].code);
        });
      } catch (err) {
        console.error('Mermaid Live Link:', err);
      }
    });
  }

  destroy() {
    this.observer.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
  }
});

module.exports = class MermaidLiveLinkPlugin extends Plugin {
  onload() {
    // Reading view, plus callouts and embedded notes rendered in Live Preview
    this.registerMarkdownPostProcessor(async (element, ctx) => {
      const info = ctx.getSectionInfo(element);
      if (info) {
        const lines = info.text.split('\n').slice(info.lineStart, info.lineEnd + 1);
        const fences = mermaidFences(lines);
        if (!fences.length) return;
        // A plain top-level code block: the section is the diagram itself.
        if (fences.length === 1 && /^\s*(```|~~~)/.test(lines[0])) {
          if (fences[0].code && !element.querySelector('.mermaid-live-link')) {
            element.appendChild(buildLink(fences[0].code));
          }
          return;
        }
        // Diagrams nested in callouts, blockquotes or lists.
        linkWhenRendered(element, fences);
        return;
      }

      // No section info (e.g. embedded notes): fall back to the source file, but only
      // when it has a single diagram, since the rendered one can't be matched otherwise.
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      if (!(file instanceof TFile)) return;
      const fences = mermaidFences((await this.app.vault.cachedRead(file)).split('\n'));
      if (fences.length === 1) linkWhenRendered(element, fences);
    });

    this.registerEditorExtension(livePreviewLinks);

    // Keep the theme sent to mermaid.live in step with Obsidian's.
    this.registerEvent(this.app.workspace.on('css-change', () => {
      document.querySelectorAll('.mermaid-live-link a').forEach((a) => {
        const code = linkCode.get(a);
        if (code) setLinkCode(a, code);
      });
    }));
  }
};
