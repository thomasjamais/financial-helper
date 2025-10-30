import { createContext, useContext, useState, ReactNode } from 'react'

export type Currency = 'USD' | 'EUR'

const CurrencyContext = createContext<{
  currency: Currency
  setCurrency: (c: Currency) => void
}>({ currency: 'USD', setCurrency: () => {} })

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('USD')
  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}


