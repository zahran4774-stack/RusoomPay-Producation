// Shared sentences / patterns used across several pages.
export const exact: Record<string, string> = {}

export const patterns: Array<[string, string]> = [
  ['خطأ: {0}', 'Error: {0}'],
  ['حدث خطأ: {0}', 'An error occurred: {0}'],
  ['فشل: {0}', 'Failed: {0}'],
  ['{0} طالب', '{0} {0?student|students}'],
  ['{0} يوم', '{0} {0?day|days}'],
]

exact['د.ك'] = 'KWD'
exact['ر.ق'] = 'QAR'
exact['خروج'] = 'Log out'
