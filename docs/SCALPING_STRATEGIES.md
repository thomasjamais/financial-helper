# Scalping Strategies Guide

This document explains the scalping strategies implemented in the financial-helper dashboard, including indicators, methodologies, and best practices for crypto futures trading.

## Overview

Scalping is a trading strategy that aims to profit from small price movements by entering and exiting positions quickly, typically within minutes to hours. This system focuses on Bitget USDT Futures pairs and uses multiple technical indicators to identify high-probability entry and exit points.

## Core Indicators

### 1. Fibonacci Retracements

Fibonacci retracements are horizontal lines indicating potential support and resistance levels based on Fibonacci ratios (23.6%, 38.2%, 50%, 61.8%, 78.6%).

**Timeframes Used:**
- 1-minute: Short-term retracements for quick entries
- 5-minute: Medium-term retracements for confirmation
- 15-minute: Longer-term retracements for trend context

**How It Works:**
- After a significant price move (swing high to swing low or vice versa), Fibonacci levels are calculated
- Price often retraces to these levels before continuing in the original direction
- Entry signals are stronger when price bounces off Fibonacci levels combined with other indicators

**Best Practices:**
- Use Fibonacci retracements in confluence with support/resistance levels
- The 38.2% and 61.8% levels are typically the strongest
- Combine with trend analysis to ensure you're trading in the direction of the larger trend

### 2. Support and Resistance Levels

Dynamic support and resistance levels are detected by identifying price points where the market has repeatedly reacted.

**Detection Method:**
- Analyzes price action over a rolling window (default: 20 candles)
- Identifies levels where price has bounced multiple times
- Filters out weak levels based on touch count and proximity

**Timeframes Used:**
- 1-minute: Immediate support/resistance for scalping entries
- 5-minute: Medium-term levels for position management
- 15-minute: Stronger levels for trend confirmation

**Best Practices:**
- Stronger support/resistance levels have more touches
- Price often respects these levels, making them ideal for stop-loss placement
- Breakouts above resistance or below support can signal trend continuation

### 3. Multi-Timeframe Trend Analysis

Trend analysis uses Exponential Moving Averages (EMAs) across multiple timeframes to determine the overall market direction.

**Timeframes Used:**
- 1-hour: Short-term trend
- 4-hour: Medium-term trend
- 1-day: Long-term trend

**How It Works:**
- Calculates 20-period EMA on each timeframe
- Compares current price to EMA on each timeframe
- Generates a bullish score if price is above EMAs, bearish if below
- Requires at least 2 out of 3 timeframes to agree for a validated signal

**Best Practices:**
- **Always trade in the direction of the trend**: Long in bullish trends, short in bearish trends
- The 1-hour trend is most relevant for scalping entries
- The 4-hour and 1-day trends provide context and help avoid counter-trend trades
- A strong trend across all timeframes increases signal confidence

### 4. Average True Range (ATR)

ATR measures market volatility and is used to calculate dynamic stop-loss and take-profit levels.

**Calculation:**
- Uses a 14-period ATR by default
- Measures the average of true ranges over the period
- True range = max(high-low, |high-prev_close|, |low-prev_close|)

**Usage:**
- Stop-loss: Typically placed at 1.0 ATR from entry
- Take-profit: Multiple levels at 1.5x, 2.5x, and 3.5x ATR
- Position sizing: Higher ATR = higher volatility = smaller position size for same risk

**Best Practices:**
- Adjust position size based on ATR: smaller positions in high volatility
- Use ATR-based stops to avoid being stopped out by normal market noise
- ATR increases during volatile periods, so stops widen automatically

## Entry Signal Generation

### Signal Confluence

A valid entry signal requires:

1. **Trend Alignment**: Multi-timeframe trend analysis must indicate a clear direction (bullish or bearish)
2. **Confidence Score**: Minimum confidence threshold (default: 60%) based on indicator agreement
3. **Fibonacci/Support-Resistance**: Price should be near a Fibonacci level or support/resistance
4. **Risk-Reward**: Calculated risk-reward ratio should be favorable (typically > 1.5:1)

### Entry Logic

**For BUY Signals:**
- Price is above EMAs on multiple timeframes (bullish trend)
- Price is near a Fibonacci support level or support level
- Indicators show bullish confluence
- Stop-loss placed below nearest support
- Multiple take-profit levels above entry

**For SELL Signals:**
- Price is below EMAs on multiple timeframes (bearish trend)
- Price is near a Fibonacci resistance level or resistance level
- Indicators show bearish confluence
- Stop-loss placed above nearest resistance
- Multiple take-profit levels below entry

## Risk Management

### Position Sizing

Position size is calculated based on:

1. **Capital Allocation**: Maximum capital allocated per pair (configurable)
2. **Risk Per Trade**: Percentage of capital risked per trade (default: 2%)
3. **Stop-Loss Distance**: Distance from entry to stop-loss in price terms
4. **Leverage**: Leverage multiplier (default: 10x, max: 125x)

**Formula:**
```
Risk Amount = Capital × Risk Per Trade
Position Size = (Risk Amount / Stop-Loss Distance) × Leverage
```

### Stop-Loss Placement

Stop-losses are placed:

1. **ATR-Based**: 1.0 ATR from entry price
2. **Support/Resistance-Based**: Just below support (for longs) or above resistance (for shorts)
3. **Whichever is Closer**: Uses the tighter stop to minimize risk

### Take-Profit Strategy

Multiple take-profit levels are used:

1. **TP1**: 1.5x ATR (25% of position)
2. **TP2**: 2.5x ATR (50% of position)
3. **TP3**: 3.5x ATR (25% of position)

This allows partial profit-taking while letting winners run.

## Backtesting

### How Backtesting Works

The backtesting system:

1. Fetches historical candle data from Bitget for the selected period (30d, 90d, 180d, 1y)
2. Simulates trades based on historical signals
3. Calculates P&L assuming orders were placed and closed according to strategy rules
4. Provides metrics: total return, win rate, profit factor, max drawdown

### Interpreting Results

**Key Metrics:**

- **Total Return %**: Overall profitability over the period
- **Win Rate**: Percentage of profitable trades
- **Profit Factor**: Average win / Average loss (should be > 1.0)
- **Max Drawdown**: Largest peak-to-trough decline
- **Risk:Reward Ratio**: Average profit per trade / Average loss per trade

**Good Results:**
- Win rate > 50%
- Profit factor > 1.5
- Max drawdown < 20%
- Consistent returns across different periods

**Warning Signs:**
- Negative returns over multiple periods
- Win rate < 40%
- Profit factor < 1.0
- High max drawdown (> 30%)

### Parameter Optimization

Use backtesting to optimize:

- **Min Confidence**: Higher = fewer but higher quality signals
- **Risk Per Trade**: Lower = more conservative, higher = more aggressive
- **Leverage**: Higher = more profit potential but more risk
- **Max Open Positions**: Limits exposure per pair

## Automated Trading

### Strategy Configuration

Each automated strategy defines:

- **Exchange**: Bitget or Binance (currently only Bitget Futures supported)
- **Symbol**: Trading pair (e.g., BTCUSDT)
- **Max Capital**: Maximum capital allocated to this pair
- **Leverage**: Leverage multiplier
- **Risk Per Trade**: Percentage of capital risked per trade
- **Min Confidence**: Minimum signal confidence to enter
- **Max Open Positions**: Maximum concurrent positions for this pair

### How It Works

1. Bot runs every 15 minutes
2. Checks all active strategies
3. For each strategy:
   - Fetches current market analysis
   - Checks if signal meets confidence threshold
   - Calculates position size based on risk parameters
   - Places order if conditions are met
   - Manages open positions (stop-loss, take-profit)

### Monitoring

- Monitor strategies regularly through the dashboard
- Review backtesting results before activating
- Start with small capital allocations
- Use simulation mode initially to validate behavior

## Best Practices

### 1. Start with Simulation

- Always test strategies in simulation mode first
- Run backtests on multiple periods before going live
- Start with small capital allocations

### 2. Risk Management

- Never risk more than 2% of capital per trade
- Use stop-losses on all positions
- Don't over-leverage (10-20x is typically sufficient)
- Limit max open positions to avoid over-exposure

### 3. Trend Following

- **Always trade with the trend**: Long in bullish markets, short in bearish markets
- Use multi-timeframe analysis to confirm trend direction
- Avoid counter-trend scalping (high risk, low reward)

### 4. Entry Timing

- Wait for price to reach Fibonacci levels or support/resistance
- Look for confluence of multiple indicators
- Enter on pullbacks in trending markets
- Avoid entering during high volatility periods

### 5. Exit Strategy

- Use multiple take-profit levels
- Trail stop-losses as price moves in your favor
- Don't hold positions too long (scalping = quick profits)
- Exit if trend reverses

### 6. Market Conditions

- Scalping works best in trending markets
- Avoid trading during low liquidity periods
- Be cautious during major news events
- Monitor market volatility (high ATR = more risk)

## Common Mistakes to Avoid

1. **Trading Against the Trend**: Always check multi-timeframe trend before entering
2. **Over-Leveraging**: High leverage amplifies both profits and losses
3. **Ignoring Stop-Losses**: Always use stop-losses, even in simulation
4. **Too Many Positions**: Limit concurrent positions to manage risk
5. **Ignoring Backtesting**: Always backtest before going live
6. **Emotional Trading**: Let the system execute trades automatically
7. **Not Monitoring**: Regularly check strategy performance and adjust parameters

## Conclusion

Scalping requires discipline, proper risk management, and a systematic approach. The indicators and strategies implemented in this system provide a solid foundation, but success depends on:

- Proper parameter configuration
- Regular monitoring and adjustment
- Strict adherence to risk management rules
- Continuous learning and optimization

Remember: Past performance does not guarantee future results. Always start with small capital allocations and gradually increase as you gain confidence in the system.

