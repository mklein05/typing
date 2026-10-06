// Types for the plain-JS checker so the backend test suite can type-check its
// import of `check-word-bank.mjs` without turning on `allowJs`.

export interface WordBankDrift {
  backend: string[];
  frontend: string[];
  problems: string[];
}

export function findWordBankDrift(): WordBankDrift;
