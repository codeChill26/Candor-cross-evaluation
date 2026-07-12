import { customAlphabet } from 'nanoid'

const suffixAlphabet = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)

function stripDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function generateSlug(name: string): string {
  const base = stripDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${base}-${suffixAlphabet()}`
}
