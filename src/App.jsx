import { useState, useEffect } from 'react'
import CalculatorTab from './CalculatorTab'
import PosTab from './PosTab'
import ReportTab from './ReportTab'
import { Calculator, ShoppingCart, BarChart3, Sun, Moon } from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState('calc')
  const [dark, setDark] = useState(true)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24">
      
      <header className="sticky top-0 z-40 bg-gradient-to-br from-slate-800 to-indigo-900 text-white px-4 py-4 rounded-b-2xl">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Kasih Itung Boss
        </h1>
        <p className="text-[11px] text-blue-200">
          by Diaz Shandikuy Mpruy
        </p>

        <button
          onClick={() => setDark(!dark)}
          className="absolute top-4 right-4 p-2 rounded-xl bg-white/10"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      {activeTab === 'calc' && <CalculatorTab />}
      {activeTab === 'pos' && <PosTab />}
      {activeTab === 'report' && <ReportTab />}

      <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-xl flex gap-2">
        <button onClick={() => setActiveTab('calc')} className={`px-4 py-2 rounded-xl ${activeTab === 'calc' ? 'bg-indigo-600' : ''}`}>
          <Calculator size={18} />
        </button>
        <button onClick={() => setActiveTab('pos')} className={`px-4 py-2 rounded-xl ${activeTab === 'pos' ? 'bg-indigo-600' : ''}`}>
          <ShoppingCart size={18} />
        </button>
        <button onClick={() => setActiveTab('report')} className={`px-4 py-2 rounded-xl ${activeTab === 'report' ? 'bg-indigo-600' : ''}`}>
          <BarChart3 size={18} />
        </button>
      </nav>

    </div>
  )
}
