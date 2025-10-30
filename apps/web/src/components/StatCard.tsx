export default function StatCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string
  value: string
  subtitle: string
  color: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-600 to-blue-700',
    green: 'bg-gradient-to-br from-green-600 to-green-700',
    purple: 'bg-gradient-to-br from-purple-600 to-purple-700',
    orange: 'bg-gradient-to-br from-orange-600 to-orange-700',
  }

  return (
    <div className={`${colorClasses[color]} rounded-lg p-5 shadow-lg`}>
      <div className="text-sm opacity-90 mb-1">{title}</div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs opacity-75">{subtitle}</div>
    </div>
  )
}


