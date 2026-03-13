const BASE_URL = import.meta.env.BASE_URL || '/'

function stripLeadingSlash(value: string): string {
  return value.startsWith('/') ? value.slice(1) : value
}

export function dataUrl(path: string): string {
  return `${BASE_URL}${stripLeadingSlash(path)}`
}

export function assetUrl(path: string): string {
  if (!path) return path
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  return `${BASE_URL}${stripLeadingSlash(path)}`
}
