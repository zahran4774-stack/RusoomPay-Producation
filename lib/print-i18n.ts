// Print / PDF windows are separate documents (window.open + document.write), so the
// on-screen translation engine never reaches them. `printHtml` runs the same dictionary
// over the generated HTML when English is selected and flips the document to LTR.
import { ENGLISH_ENABLED, LANGUAGE_STORAGE_KEY, translateSentenceRuns, translateText } from './i18n'

const AR_LETTER = /[ؠ-ٟٮ-ۓەۺ-ۿ]/
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])
const ATTRS = ['title', 'placeholder', 'alt', 'aria-label']

export function isEnglishSelected(): boolean {
  if (!ENGLISH_ENABLED || typeof window === 'undefined') return false
  try { return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' } catch { return false }
}

function translateChildren(el: Element) {
  const runs: Text[][] = [[]]
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) runs[runs.length - 1].push(child as Text)
    else if (child.nodeType === 1) runs.push([])
  }
  const nodes = runs.flat()
  if (!nodes.some((n) => AR_LETTER.test(n.nodeValue ?? ''))) return

  const sources = runs.map((run) => run.map((n) => n.nodeValue ?? '').join(''))
  const segments = translateSentenceRuns(sources)
  if (segments && segments.every((s, i) => runs[i].length > 0 || !s.trim())) {
    runs.forEach((run, i) => run.forEach((n, j) => { n.nodeValue = j === 0 ? segments[i] : '' }))
    return
  }
  const arabicNodes = nodes.filter((n) => AR_LETTER.test(n.nodeValue ?? '')).length
  if (arabicNodes > 1) return // multi-node sentence without a template stays as is
  for (const n of nodes) n.nodeValue = translateText(n.nodeValue ?? '', 'en')
}

function walk(el: Element) {
  if (SKIP.has(el.tagName)) return
  for (const name of ATTRS) {
    const v = el.getAttribute(name)
    if (v && AR_LETTER.test(v)) el.setAttribute(name, translateText(v, 'en'))
  }
  if (el.hasAttribute('dir')) el.setAttribute('dir', 'ltr')
  translateChildren(el)
  for (const child of Array.from(el.children)) walk(child)
}

function flipCss(css: string): string {
  return css
    .replace(/direction\s*:\s*rtl/gi, 'direction:ltr')
    .replace(/text-align\s*:\s*(right|left)/gi, (_, side: string) => `text-align:${side.toLowerCase() === 'right' ? 'left' : 'right'}`)
}

/** Returns the HTML to write into a print window, translated when English is selected. */
export function printHtml(html: string): string {
  if (!isEnglishSelected() || typeof DOMParser === 'undefined') return html
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const root = doc.documentElement
    root.setAttribute('dir', 'ltr')
    root.setAttribute('lang', 'en')
    if (doc.title && AR_LETTER.test(doc.title)) doc.title = translateText(doc.title, 'en')
    walk(root)
    doc.querySelectorAll('style').forEach((style) => { style.textContent = flipCss(style.textContent ?? '') })
    return '<!DOCTYPE html>\n' + root.outerHTML
  } catch {
    return html
  }
}
