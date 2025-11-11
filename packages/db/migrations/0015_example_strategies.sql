-- Insert example strategies (user_id = 'system')
-- These are example strategies that users can duplicate and try
-- This migration is idempotent - it only inserts if strategies don't already exist

-- Strategy 1: Moving Average Crossover (Golden Cross / Death Cross)
INSERT INTO strategies (user_id, name, code, params_schema, allocated_amount_usd, is_active)
SELECT 
  'system',
  'Moving Average Crossover',
  'class Strategy {
  name = ''Moving Average Crossover''
  
  initialize(candles) {
    // No initialization needed
  }
  
  onCandle(candle, index, candles) {
    if (index < 50) return ''hold''
    
    const closes = candles.map(c => c.close)
    const sma20 = indicators.sma(closes, 20)
    const sma50 = indicators.sma(closes, 50)
    
    const currentSma20 = sma20[index]
    const currentSma50 = sma50[index]
    const prevSma20 = sma20[index - 1]
    const prevSma50 = sma50[index - 1]
    
    // Golden cross: SMA20 crosses above SMA50
    if (prevSma20 <= prevSma50 && currentSma20 > currentSma50) {
      return ''buy''
    }
    
    // Death cross: SMA20 crosses below SMA50
    if (prevSma20 >= prevSma50 && currentSma20 < currentSma50) {
      return ''sell''
    }
    
    return ''hold''
  }
}',
  NULL,
  1000,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM strategies WHERE user_id = 'system' AND name = 'Moving Average Crossover'
)
LIMIT 1;

-- Strategy 2: RSI Oversold/Overbought
INSERT INTO strategies (user_id, name, code, params_schema, allocated_amount_usd, is_active)
SELECT 
  'system',
  'RSI Oversold/Overbought',
  'class Strategy {
  name = ''RSI Oversold/Overbought''
  
  initialize(candles) {
    // No initialization needed
  }
  
  onCandle(candle, index, candles) {
    if (index < 14) return ''hold''
    
    const closes = candles.map(c => c.close)
    const rsi = indicators.rsi(closes, 14)
    const currentRsi = rsi[index]
    const prevRsi = rsi[index - 1]
    
    // Buy when RSI crosses above 30 (oversold recovery)
    if (prevRsi <= 30 && currentRsi > 30) {
      return ''buy''
    }
    
    // Sell when RSI crosses below 70 (overbought reversal)
    if (prevRsi >= 70 && currentRsi < 70) {
      return ''sell''
    }
    
    return ''hold''
  }
}',
  NULL,
  1000,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM strategies WHERE user_id = 'system' AND name = 'RSI Oversold/Overbought'
)
LIMIT 1;

-- Strategy 3: MACD Crossover
INSERT INTO strategies (user_id, name, code, params_schema, allocated_amount_usd, is_active)
SELECT 
  'system',
  'MACD Crossover',
  'class Strategy {
  name = ''MACD Crossover''
  
  initialize(candles) {
    // No initialization needed
  }
  
  onCandle(candle, index, candles) {
    if (index < 26) return ''hold''
    
    const closes = candles.map(c => c.close)
    const macdData = indicators.macd(closes, 12, 26, 9)
    const macd = macdData.macd
    const signal = macdData.signal
    
    const currentMacd = macd[index]
    const currentSignal = signal[index]
    const prevMacd = macd[index - 1]
    const prevSignal = signal[index - 1]
    
    // Bullish crossover: MACD crosses above signal line
    if (prevMacd <= prevSignal && currentMacd > currentSignal) {
      return ''buy''
    }
    
    // Bearish crossover: MACD crosses below signal line
    if (prevMacd >= prevSignal && currentMacd < currentSignal) {
      return ''sell''
    }
    
    return ''hold''
  }
}',
  NULL,
  1000,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM strategies WHERE user_id = 'system' AND name = 'MACD Crossover'
)
LIMIT 1;

-- Strategy 4: Bollinger Bands Mean Reversion
INSERT INTO strategies (user_id, name, code, params_schema, allocated_amount_usd, is_active)
SELECT 
  'system',
  'Bollinger Bands Mean Reversion',
  'class Strategy {
  name = ''Bollinger Bands Mean Reversion''
  
  initialize(candles) {
    // No initialization needed
  }
  
  onCandle(candle, index, candles) {
    if (index < 20) return ''hold''
    
    const closes = candles.map(c => c.close)
    const bb = indicators.bollingerBands(closes, 20, 2)
    const upper = bb.upper
    const lower = bb.lower
    const middle = bb.middle
    
    const currentPrice = closes[index]
    const currentUpper = upper[index]
    const currentLower = lower[index]
    const currentMiddle = middle[index]
    const prevPrice = closes[index - 1]
    
    // Buy when price touches or goes below lower band (oversold)
    if (prevPrice > currentLower && currentPrice <= currentLower) {
      return ''buy''
    }
    
    // Sell when price touches or goes above upper band (overbought)
    if (prevPrice < currentUpper && currentPrice >= currentUpper) {
      return ''sell''
    }
    
    return ''hold''
  }
}',
  NULL,
  1000,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM strategies WHERE user_id = 'system' AND name = 'Bollinger Bands Mean Reversion'
)
LIMIT 1;

-- Strategy 5: Stochastic Oscillator
INSERT INTO strategies (user_id, name, code, params_schema, allocated_amount_usd, is_active)
SELECT 
  'system',
  'Stochastic Oscillator',
  'class Strategy {
  name = ''Stochastic Oscillator''
  
  initialize(candles) {
    // No initialization needed
  }
  
  onCandle(candle, index, candles) {
    if (index < 14) return ''hold''
    
    const stoch = indicators.stochastic(candles, 14, 3)
    const k = stoch.k
    const d = stoch.d
    
    const currentK = k[index]
    const currentD = d[index]
    const prevK = k[index - 1]
    const prevD = d[index - 1]
    
    // Buy when %K crosses above %D from below 20 (oversold)
    if (prevK < 20 && prevK <= prevD && currentK > currentD && currentK > 20) {
      return ''buy''
    }
    
    // Sell when %K crosses below %D from above 80 (overbought)
    if (prevK > 80 && prevK >= prevD && currentK < currentD && currentK < 80) {
      return ''sell''
    }
    
    return ''hold''
  }
}',
  NULL,
  1000,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM strategies WHERE user_id = 'system' AND name = 'Stochastic Oscillator'
)
LIMIT 1;

