export function validateBudget(budgetStr: string | null): {
  valid: boolean
  budget?: number
  error?: string
} {
  if (!budgetStr) {
    return { valid: false, error: 'Budget is required' }
  }

  const budget = Number(budgetStr)

  if (!isFinite(budget)) {
    return { valid: false, error: 'Budget must be a number' }
  }

  if (budget <= 0) {
    return { valid: false, error: 'Budget must be greater than 0' }
  }

  return { valid: true, budget }
}

