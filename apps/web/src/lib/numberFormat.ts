/**
 * Formats a number with intelligent decimal precision
 * For very small numbers, shows significant digits instead of fixed decimal places
 * For regular numbers, uses standard formatting
 */
export function formatNumber(value: number | null | undefined, minDecimals = 2, maxDecimals = 8): string {
  if (value === null || value === undefined || !isFinite(value)) {
    return '-'
  }

  if (value === 0) {
    return '0.' + '0'.repeat(minDecimals)
  }

  // For very small numbers (< 0.0001), use scientific notation or show more significant digits
  if (Math.abs(value) < 0.0001 && value !== 0) {
    // Count significant digits
    const absValue = Math.abs(value)
    let decimals = 0
    let temp = absValue
    
    // Find first non-zero digit
    while (temp < 1 && decimals < 15) {
      temp *= 10
      decimals++
      if (Math.floor(temp) > 0) {
        // Found first significant digit, add a few more for context
        return value.toFixed(decimals + 3)
      }
    }
    
    // Fallback: use scientific notation for extremely small numbers
    return value.toExponential(4)
  }

  // For regular numbers, remove trailing zeros while respecting min/max decimals
  const absValue = Math.abs(value)
  let decimals = minDecimals

  // If the number has decimal places, try to find optimal precision
  if (absValue < 1) {
    // For numbers between 0 and 1, show enough decimals to be meaningful
    decimals = Math.max(minDecimals, Math.min(maxDecimals, 6))
  } else if (absValue >= 1000) {
    // For large numbers, reduce decimals
    decimals = Math.min(2, maxDecimals)
  } else {
    decimals = Math.min(maxDecimals, 4)
  }

  // Format and remove trailing zeros
  const formatted = value.toFixed(decimals)
  return formatted.replace(/\.?0+$/, '') || '0'
}

/**
 * Formats a price with appropriate precision based on the value
 */
export function formatPrice(value: number | null | undefined): string {
  return formatNumber(value, 2, 8)
}

/**
 * Formats a quantity with appropriate precision based on the value
 */
export function formatQuantity(value: number | null | undefined): string {
  return formatNumber(value, 2, 8)
}

/**
 * Formats currency with 2 decimal places
 */
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

