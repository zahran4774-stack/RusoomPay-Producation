// Extra English dictionaries, split by area so each file stays reviewable.
//  - `exact`    : whole-text keys (same semantics as the main dictionary in lib/i18n.ts)
//  - `patterns` : [arabicTemplate, englishTemplate] pairs
//      {0} {1} ...   placeholders (numbers, amounts, names – translated recursively when possible)
//      {0?one|many}  plural macro driven by the numeric value of placeholder 0
//      ¦             marks an element boundary (e.g. <b>…</b>) inside a multi-node sentence
// First definition wins: the main dictionary, then the modules in the order below.
import * as common from './common'
import * as fees from './fees'
import * as accounting from './accounting'

type Module = { exact: Record<string, string>; patterns: Array<[string, string]> }

const MODULES: Module[] = [common, fees, accounting]

export const EXTRA_EXACT: Record<string, string> = {}
export const PATTERN_PAIRS: Array<[string, string]> = []

for (const mod of MODULES) {
  for (const [ar, en] of Object.entries(mod.exact)) {
    if (!(ar in EXTRA_EXACT)) EXTRA_EXACT[ar] = en
  }
  PATTERN_PAIRS.push(...mod.patterns)
}
