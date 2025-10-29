export type RebalancingSuggestion = {
  asset: string
  currentAllocation: number
  recommendedAllocation: number
  action: 'BUY' | 'SELL' | 'HOLD'
  reason: string
}

export type PortfolioRebalancingAdvice = {
  suggestions: RebalancingSuggestion[]
  summary: string
  confidence: number
  timestamp: number
}

export interface AIProvider {
  generateRebalancingAdvice(params: {
    portfolio: Array<{ asset: string; valueUSD: number }>
    totalValueUSD: number
    targetAllocations?: Record<string, number>
  }): Promise<PortfolioRebalancingAdvice>
}

export class OpenAIProvider implements AIProvider {
  constructor(private apiKey: string) {}

  async generateRebalancingAdvice(params: {
    portfolio: Array<{ asset: string; valueUSD: number }>
    totalValueUSD: number
    targetAllocations?: Record<string, number>
  }): Promise<PortfolioRebalancingAdvice> {
    const { portfolio, totalValueUSD, targetAllocations } = params

    const currentAllocations = portfolio.reduce(
      (acc, item) => {
        acc[item.asset] = (item.valueUSD / totalValueUSD) * 100
        return acc
      },
      {} as Record<string, number>,
    )

    const prompt = this.buildPrompt(currentAllocations, targetAllocations)

    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content:
                  'You are a cryptocurrency portfolio rebalancing advisor. Provide actionable recommendations.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const advice = this.parseAIResponse(
        data.choices[0]?.message?.content || '',
      )

      return {
        ...advice,
        suggestions: this.generateSuggestions(
          currentAllocations,
          advice.recommendedAllocations || {},
        ),
        timestamp: Date.now(),
      }
    } catch (err) {
      return this.fallbackAdvice(currentAllocations)
    }
  }

  private buildPrompt(
    currentAllocations: Record<string, number>,
    targetAllocations?: Record<string, number>,
  ): string {
    const allocationsText = Object.entries(currentAllocations)
      .map(([asset, pct]) => `${asset}: ${pct.toFixed(2)}%`)
      .join(', ')

    let prompt = `Current portfolio allocations: ${allocationsText}\n\n`
    if (targetAllocations) {
      const targetText = Object.entries(targetAllocations)
        .map(([asset, pct]) => `${asset}: ${pct.toFixed(2)}%`)
        .join(', ')
      prompt += `Target allocations: ${targetText}\n\n`
    }

    prompt +=
      'Analyze this portfolio and provide rebalancing recommendations. Consider:\n'
    prompt += '1. Diversification benefits\n'
    prompt += '2. Market conditions\n'
    prompt += '3. Risk management\n'
    prompt += '4. Long-term growth potential\n\n'
    prompt +=
      'Provide your response as JSON with: recommendedAllocations (asset -> percentage), summary (text), confidence (0-1).'

    return prompt
  }

  private parseAIResponse(content: string): {
    recommendedAllocations: Record<string, number>
    summary: string
    confidence: number
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          recommendedAllocations: parsed.recommendedAllocations || {},
          summary: parsed.summary || 'AI analysis unavailable',
          confidence: parsed.confidence || 0.5,
        }
      }
    } catch {
      // Fall through to fallback
    }

    return {
      recommendedAllocations: {},
      summary: 'AI analysis could not be parsed',
      confidence: 0.3,
    }
  }

  private generateSuggestions(
    current: Record<string, number>,
    recommended: Record<string, number>,
  ): RebalancingSuggestion[] {
    const allAssets = new Set([
      ...Object.keys(current),
      ...Object.keys(recommended),
    ])

    return Array.from(allAssets).map((asset) => {
      const currentPct = current[asset] || 0
      const recommendedPct = recommended[asset] || 0
      const diff = recommendedPct - currentPct

      let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD'
      if (Math.abs(diff) < 1) {
        action = 'HOLD'
      } else if (diff > 0) {
        action = 'BUY'
      } else {
        action = 'SELL'
      }

      return {
        asset,
        currentAllocation: currentPct,
        recommendedAllocation: recommendedPct,
        action,
        reason:
          diff > 0
            ? `Increase allocation by ${diff.toFixed(2)}% for better diversification`
            : diff < 0
              ? `Reduce allocation by ${Math.abs(diff).toFixed(2)}% to rebalance`
              : 'Allocation is within target range',
      }
    })
  }

  private fallbackAdvice(
    currentAllocations: Record<string, number>,
  ): PortfolioRebalancingAdvice {
    return {
      suggestions: Object.entries(currentAllocations).map(([asset, pct]) => ({
        asset,
        currentAllocation: pct,
        recommendedAllocation: pct,
        action: 'HOLD' as const,
        reason: 'AI service unavailable, maintaining current allocation',
      })),
      summary:
        'AI prediction service unavailable. Using default recommendations.',
      confidence: 0.2,
      timestamp: Date.now(),
    }
  }
}

export async function getRebalancingAdvice(params: {
  portfolio: Array<{ asset: string; valueUSD: number }>
  totalValueUSD: number
  aiProvider?: AIProvider
  targetAllocations?: Record<string, number>
}): Promise<PortfolioRebalancingAdvice> {
  const { portfolio, totalValueUSD, aiProvider, targetAllocations } = params

  if (!aiProvider) {
    return {
      suggestions: [],
      summary: 'No AI provider configured',
      confidence: 0,
      timestamp: Date.now(),
    }
  }

  return aiProvider.generateRebalancingAdvice({
    portfolio,
    totalValueUSD,
    targetAllocations,
  })
}
