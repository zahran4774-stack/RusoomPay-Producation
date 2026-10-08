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
