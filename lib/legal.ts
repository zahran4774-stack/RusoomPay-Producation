export const LEGAL_VERSIONS = {
  terms: '2026-07-23',
  privacy: '2026-07-23',
} as const;

export type LegalDocType = keyof typeof LEGAL_VERSIONS;
