import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import NewSweep from './pages/NewSweep'
import Run from './pages/Run'
import Results from './pages/Results'
import Runs from './pages/Runs'
import Trades from './pages/Trades'
import ExpressionLanguageHelp from './pages/ExpressionLanguageHelp'
import ActiveStrategiesPage from './pages/ActiveStrategiesPage'
import ActiveStrategyDetailPage from './pages/ActiveStrategyDetailPage'
import ActiveStrategy from './pages/ActiveStrategy'

function ScreenerPlaceholder() {
  return (
    <div style={{ padding: 32 }}>
      <h1>Screener</h1>
      <div style={{ color: 'var(--muted)', marginTop: 8 }}>Coming soon — universe screening and signal discovery.</div>
    </div>
  )
}

export default function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, padding: 20, boxSizing: 'border-box', width: 0 }}>
        <div style={{ maxWidth: 1100 }}>
        <Routes>
          <Route path="/runs" element={<Runs />} />
          <Route path="/new" element={<NewSweep />} />
          <Route path="/run/:id" element={<Run />} />
          <Route path="/results/:id" element={<Results />} />
          <Route path="/trades/:runId/:permId" element={<Trades />} />
          <Route path="/help/expression-language" element={<ExpressionLanguageHelp />} />
          <Route path="/active" element={<ActiveStrategiesPage />} />
          <Route path="/active/:activeId" element={<ActiveStrategy />} />
          <Route path="/active/:activeId/history" element={<ActiveStrategyDetailPage />} />
          <Route path="/screener" element={<ScreenerPlaceholder />} />
          <Route index element={<Runs />} />
        </Routes>
        </div>
      </main>
    </div>
  )
}
