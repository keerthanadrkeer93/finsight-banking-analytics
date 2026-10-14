import { useCallback, useEffect, useState } from 'react'
import { fmtDate } from './lib/dates.ts'
import { loadDataset } from './lib/loadData.ts'
import type { Dataset } from './lib/types.ts'
import { Header } from './components/layout/Header.tsx'
import { ErrorState, LoadingScreen } from './components/states.tsx'
import { Overview } from './pages/Overview.tsx'

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; ds: Dataset }

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const load = useCallback(() => {
    setState({ status: 'loading' })
    loadDataset()
      .then((ds) => setState({ status: 'ready', ds }))
      .catch((e: unknown) => setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }))
  }, [])
  useEffect(load, [load])

  return (
    <>
      <Header asOf={state.status === 'ready' ? fmtDate(state.ds.maxDay) : undefined} />
      {state.status === 'loading' && <LoadingScreen />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'ready' && <Overview ds={state.ds} />}
    </>
  )
}
