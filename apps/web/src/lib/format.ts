export function formatNumber(value: number, options?: Intl.NumberFormatOptions, locale?: string) {
  const loc = locale || (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
  return new Intl.NumberFormat(loc, options).format(value)
}


