import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () =>
      (
        await axios.get('/healthz', {
          baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
        })
      ).data,
  })
}

function useBalances() {
  return useQuery({
    queryKey: ['balances'],
    queryFn: async () =>
      (
        await axios.get('/v1/balances', {
          baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
        })
      ).data,
    retry: false,
  })
}

function useSetConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) =>
      (
        await axios.post('/v1/bitget/config', body, {
          baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080',
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['balances'] }),
  })
}

export default function App() {
  const { data } = useHealth()
  const { data: balances, error } = useBalances()
  const setConfig = useSetConfig()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Crypto Dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">
        API health: {data?.ok ? 'OK' : '...'}
      </p>
      <div className="mt-6 space-y-4">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget as HTMLFormElement)
            setConfig.mutate({
              exchange: 'bitget',
              key: fd.get('key'),
              secret: fd.get('secret'),
              passphrase: fd.get('passphrase'),
              env: (fd.get('env') as string) || 'paper',
            })
          }}
        >
          <h2 className="font-semibold">Bitget Config</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="border p-2" name="key" placeholder="API Key" />
            <input
              className="border p-2"
              name="secret"
              placeholder="API Secret"
            />
            <input
              className="border p-2"
              name="passphrase"
              placeholder="Passphrase"
            />
            <select className="border p-2" name="env" defaultValue="paper">
              <option value="paper">paper</option>
              <option value="live">live</option>
            </select>
          </div>
          <button
            className="mt-2 px-3 py-2 bg-blue-600 text-white rounded"
            type="submit"
            disabled={setConfig.isPending}
          >
            Save Config
          </button>
        </form>

        <div>
          <h2 className="font-semibold">Balances</h2>
          {error ? (
            <p className="text-red-600 text-sm">
              {(error as any)?.response?.data?.error ||
                'Set config to view balances'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm text-slate-600">Spot</h3>
                <ul className="list-disc ml-6">
                  {balances?.spot?.map((b: any, i: number) => (
                    <li key={i}>
                      {b.asset}: {b.free}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm text-slate-600">Futures</h3>
                <ul className="list-disc ml-6">
                  {balances?.futures?.map((b: any, i: number) => (
                    <li key={i}>
                      {b.asset}: {b.free}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
