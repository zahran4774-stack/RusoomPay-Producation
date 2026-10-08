import { describe, expect, it } from 'vitest'
import { translateSentenceRuns, translateText } from '@/lib/i18n'

describe('i18n sentence templates', () => {
  it('translates numeric templates with the plural macro', () => {
    expect(translateText('12 طالب', 'en')).toBe('12 students')
    expect(translateText('1 طالب', 'en')).toBe('1 student')
    expect(translateText('خطأ: 5', 'en')).toBe('Error: 5')
  })

  it('keeps Arabic when no template matches', () => {
    expect(translateText('جملة غير معروفة أبداً 5', 'en')).toBe('جملة غير معروفة أبداً 5')
  })

  it('translates a sentence split across text nodes', () => {
    expect(translateSentenceRuns(['12 طالب'])).toEqual(['12 students'])
  })

  it('returns null when the sentence is unknown', () => {
    expect(translateSentenceRuns(['شيء مجهول ', '7'])).toBeNull()
  })
})

describe('extra dictionaries integrity', () => {
  it('patterns are well-formed and unique', async () => {
    const { PATTERN_PAIRS, EXTRA_EXACT } = await import('@/lib/i18n-dict')
    const seen = new Set<string>()
    for (const [ar, en] of PATTERN_PAIRS) {
      expect(seen.has(ar), `duplicate pattern ${ar}`).toBe(false)
      seen.add(ar)
      const arSlots = new Set([...ar.matchAll(/\{(\d+)\}/g)].map((m) => m[1]))
      const enSlots = [...en.matchAll(/\{(\d+)\??/g)].map((m) => m[1])
      for (const slot of enSlots) expect(arSlots.has(slot), `slot ${slot} missing in ${ar}`).toBe(true)
      expect(ar.split('¦').length, `boundary count in ${ar}`).toBe(en.split('¦').length)
      expect(/[ؠ-ۿ]/.test(en), `Arabic left in English side of ${ar}`).toBe(false)
    }
    for (const [ar, en] of Object.entries(EXTRA_EXACT)) {
      expect(/[ؠ-ۿ]/.test(en), `Arabic left in English side of ${ar}`).toBe(false)
    }
  })
})
