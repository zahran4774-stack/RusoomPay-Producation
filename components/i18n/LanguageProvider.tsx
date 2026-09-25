'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LANGUAGE,
  ENGLISH_ENABLED,
  LANGUAGE_STORAGE_KEY,
  STANDALONE_ONLY,
  type Language,
  translateText,
} from '@/lib/i18n'

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const ARABIC = /[\u0600-\u06ff]/
// Arabic letters only (digits/punctuation excluded)
const AR_WORD = /[\u0620-\u065F\u066E-\u06D3\u06D5\u06FA-\u06FF]/
const ATTRIBUTES = ['placeholder', 'aria-label', 'title'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE'])
const IGNORE_SELECTOR = '[data-i18n-ignore="true"],[contenteditable="true"]'

// source = the Arabic text React rendered; applied = what is currently shown.
// If the DOM value differs from `applied`, React updated the node and the
// new value becomes the source (prevents stale numbers/amounts).
type NodeState = { source: string; applied: string }

const textState = new WeakMap<Text, NodeState>()
// True once English has been applied in this tab; Arabic restore pass is skipped otherwise.
let hasTranslated = false

const attrState = new WeakMap<Element, Partial<Record<(typeof ATTRIBUTES)[number], NodeState>>>()

function readStoredLanguage(): Language {
  if (!ENGLISH_ENABLED) return 'ar'
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return value === 'en' || value === 'ar' ? value : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function writeStoredLanguage(language: Language) {
  try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language) } catch { /* private mode */ }
}

function applyDocumentLanguage(language: Language) {
  const html = document.documentElement
  html.lang = language
  html.dir = language === 'ar' ? 'rtl' : 'ltr'
  html.dataset.lang = language
}

function isIgnored(element: Element | null): boolean {
  if (!element) return true
  if (SKIP_TAGS.has(element.tagName)) return true
  return element.closest(IGNORE_SELECTOR) !== null
}

// Returns the tracked state of a text node, refreshing it when React changed the value.
function syncTextState(text: Text): NodeState | undefined {
  const current = text.nodeValue ?? ''
  let state = textState.get(text)
  if (state && current !== state.applied) {
    textState.delete(text) // React wrote a new value → it becomes the new source
    state = undefined
  }
  if (!state) {
    if (!ARABIC.test(current)) return undefined
    state = { source: current, applied: current }
    textState.set(text, state)
  }
  return state
}

// Processes the DIRECT text children of one element as a group.
// JSX like `صفحة {page} من {total}` renders several text nodes in one element.
// Translating them one by one gives broken English ("Page 3 From 10"), so when
// more than one text node in the group contains Arabic words, the whole
// sentence stays in Arabic (all-or-nothing at sentence level).
function processTextGroup(parent: Element | null, language: Language) {
  if (!parent || isIgnored(parent)) return
  const entries: Array<[Text, NodeState]> = []
  let arabicWordNodes = 0
  let contentNodes = 0
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType !== Node.TEXT_NODE) continue
    if ((child.nodeValue ?? '').trim()) contentNodes++
    const state = syncTextState(child as Text)
    if (!state) continue
    entries.push([child as Text, state])
    if (AR_WORD.test(state.source)) arabicWordNodes++
  }
  const atomic = arabicWordNodes > 1
  for (const [text, state] of entries) {
    // "من {total}" means "of", not "From" — particles translate only as a standalone label.
    const particle = contentNodes > 1 && STANDALONE_ONLY.has(state.source.trim())
    const next = language === 'en' && !atomic && !particle ? translateText(state.source, 'en') : state.source
    if (next !== text.nodeValue) text.nodeValue = next // write only on real change → no mutation loop
    state.applied = next
  }
}

function processAttributes(element: Element, language: Language) {
  if (isIgnored(element)) return
  let states = attrState.get(element)
  for (const name of ATTRIBUTES) {
    const current = element.getAttribute(name)
    if (current === null) continue
    let state = states?.[name]
    if (state && current !== state.applied) state = undefined
    if (!state) {
      if (!ARABIC.test(current)) {
        if (states) delete states[name]
        continue
      }
      state = { source: current, applied: current }
      if (!states) {
        states = {}
        attrState.set(element, states)
      }
      states[name] = state
    }
    const next = language === 'en' ? translateText(state.source, 'en') : state.source
    if (next !== current) element.setAttribute(name, next)
    state.applied = next
  }
}

function processTree(root: Node, language: Language) {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextGroup((root as Text).parentElement, language)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const element = root as Element
  if (isIgnored(element)) return

  processAttributes(element, language)
  for (const child of element.querySelectorAll('[placeholder],[aria-label],[title]')) {
    processAttributes(child, language)
  }

  const parents = new Set<Element>()
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const parent = (node as Text).parentElement
    if (parent) parents.add(parent)
  }
  for (const parent of parents) processTextGroup(parent, language)
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setLanguageState(readStoredLanguage())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    writeStoredLanguage(language)
    applyDocumentLanguage(language)
    if (language === 'ar') {
      // Arabic is the source language: no observer, zero overhead.
      // Restore pass only if English was shown earlier in this tab.
      if (hasTranslated) processTree(document.body, 'ar')
      return
    }

    hasTranslated = true
    processTree(document.body, language) // full pass only when the language changes

    // Runs as a microtask right after React commits — before the browser paints,
    // so new content never flashes in Arabic while English is selected.
    const observer = new MutationObserver((records) => {
      const subtrees = new Set<Node>()   // new content → full processing
      const groups = new Set<Element>()  // parents whose text children changed
      const attrs = new Set<Element>()   // React changed placeholder/title/aria-label
      for (const record of records) {
        if (record.type === 'characterData') {
          const parent = (record.target as Text).parentElement
          if (parent) groups.add(parent)
        } else if (record.type === 'attributes') {
          attrs.add(record.target as Element)
        } else {
          groups.add(record.target as Element) // text sibling added/removed → re-evaluate sentence
          record.addedNodes.forEach((added) => subtrees.add(added))
        }
      }
      for (const node of subtrees) if (node.isConnected) processTree(node, language)
      for (const parent of groups) if (parent.isConnected) processTextGroup(parent, language)
      for (const element of attrs) if (element.isConnected) processAttributes(element, language)
      observer.takeRecords() // discard mutations caused by our own writes
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRIBUTES],
    })

    return () => observer.disconnect()
  }, [language, ready])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_STORAGE_KEY) return
      if (event.newValue === 'ar' || (event.newValue === 'en' && ENGLISH_ENABLED)) setLanguageState(event.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage: (next) => setLanguageState(next === 'en' && !ENGLISH_ENABLED ? 'ar' : next),
    toggleLanguage: () => setLanguageState((current) => (current === 'ar' && ENGLISH_ENABLED ? 'en' : 'ar')),
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
