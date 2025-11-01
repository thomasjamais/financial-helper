export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !isFinite(value)) {
    return '-'
  }
  if (value === 0) {
    return '0'
  }
  if (Math.abs(value) < 0.0001) {
    // For very small numbers, use scientific notation or more precision
    return value.toPrecision(2).replace(/\.?0+e/, 'e') // e.g., 1.2e-6
  }
  if (Math.abs(value) < 1) {
    return value.toFixed(6).replace(/\.?0+$/, '') // Remove trailing zeros
  }
  return value.toFixed(4).replace(/\.?0+$/, '') // Remove trailing zeros
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !isFinite(value)) {
    return '-'
  }
  if (value === 0) {
    return '0'
  }
  if (Math.abs(value) < 0.0001) {
    return value.toPrecision(2).replace(/\.?0+e/, 'e')
  }
  if (Math.abs(value) < 1) {
    return value.toFixed(6).replace(/\.?0+$/, '')
  }
  return value.toFixed(4).replace(/\.?0+$/, '')
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !isFinite(value)) {
    return '-'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
