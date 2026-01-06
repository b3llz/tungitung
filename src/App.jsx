import React, { useState, useEffect } from 'react';
import CalculatorTab from './CalculatorTab';
import './index.css';

function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if(darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      
      {/* NAVBAR */}
      <nav className="bg-white dark:bg-slate-800 shadow p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <button className="font-bold text-slate-700 dark:text-slate-200">Kasir</button>
          <button className="font-bold text-slate-700 dark:text-slate-200">Laporan</button>
        </div>
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="px-3 py-1 rounded bg-indigo-500 text-white text-sm"
        >
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </nav>

      {/* CONTENT */}
      <CalculatorTab />
    </div>
  );
}

export default App;
