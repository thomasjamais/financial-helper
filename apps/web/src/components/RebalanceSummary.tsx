export default function RebalanceSummary({ summary, confidence }: { summary: string; confidence: number }) {
  return (
    <div className="p-3 bg-purple-900 border border-purple-700 rounded">
      <div className="font-semibold mb-1 text-white">Summary</div>
      <div className="text-sm text-purple-200">{summary}</div>
      <div className="text-xs text-purple-300 mt-1">Confidence: {(confidence * 100).toFixed(0)}%</div>
    </div>
  )
}


