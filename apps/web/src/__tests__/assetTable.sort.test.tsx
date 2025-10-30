import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AssetTable from '../components/AssetTable'
import { CurrencyProvider } from '../components/CurrencyContext'

const assets = [
  { asset: 'BTC', amount: 1, priceUSD: 50000, priceEUR: 45000, valueUSD: 50000, valueEUR: 45000 },
  { asset: 'ETH', amount: 10, priceUSD: 3000, priceEUR: 2700, valueUSD: 30000, valueEUR: 27000 },
  { asset: 'USDT', amount: 10000, priceUSD: 1, priceEUR: 0.9, valueUSD: 10000, valueEUR: 9000 },
]

function renderWithCurrency(ui: React.ReactNode) {
  return render(<CurrencyProvider>{ui}</CurrencyProvider>)
}

describe('AssetTable sorting', () => {
  it('sorts by value desc by default', () => {
    renderWithCurrency(<AssetTable assets={assets as any} />)
    const rows = screen.getAllByRole('row')
    // header + 3 asset rows
    expect(rows).toHaveLength(4)
    expect(rows[1].textContent).toContain('BTC')
  })

  it('sorts by asset asc when clicking Asset header then toggling to Asc', () => {
    renderWithCurrency(<AssetTable assets={assets as any} />)
    fireEvent.click(screen.getByText('Asset'))
    fireEvent.click(screen.getByText('Desc'))
    const rows = screen.getAllByRole('row')
    expect(rows[1].textContent).toContain('BTC')
    expect(rows[2].textContent).toContain('ETH')
    expect(rows[3].textContent).toContain('USDT')
  })

  it('toggles direction', () => {
    renderWithCurrency(<AssetTable assets={assets as any} />)
    fireEvent.click(screen.getByText('Asset'))
    fireEvent.click(screen.getByText('Desc'))
    const rows = screen.getAllByRole('row')
    // After toggle to Asc, first should be BTC
    expect(rows[1].textContent).toContain('BTC')
  })
})
