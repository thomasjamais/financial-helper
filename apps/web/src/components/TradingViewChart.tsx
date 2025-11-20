import { useEffect, useRef } from 'react'

interface TradingViewChartProps {
  symbol: string
  interval?: string
  height?: number
}

export function TradingViewChart({
  symbol,
  interval = '15',
  height = 500,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const containerId = `tradingview_${symbol}_${Date.now()}`
    containerRef.current.id = containerId

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = () => {
      if (window.TradingView && containerRef.current) {
        new window.TradingView.widget({
          autosize: true,
          symbol: `BITGET:${symbol}`,
          interval: interval,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#1e1e1e',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: containerId,
          height: height,
          width: '100%',
        })
      }
    }

    if (!document.querySelector(`script[src="${script.src}"]`)) {
      document.head.appendChild(script)
    } else {
      if (window.TradingView && containerRef.current) {
        new window.TradingView.widget({
          autosize: true,
          symbol: `BITGET:${symbol}`,
          interval: interval,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#1e1e1e',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: containerId,
          height: height,
          width: '100%',
        })
      }
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [symbol, interval, height])

  return (
    <div
      ref={containerRef}
      style={{ height: `${height}px`, width: '100%' }}
      className="tradingview-widget-container"
    />
  )
}

declare global {
  interface Window {
    TradingView: any
  }
}

