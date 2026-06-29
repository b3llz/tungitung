import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // pastikan ini ada untuk Tailwind / styling

// Error Boundary: mencegah "layar putih kosong" jika ada komponen yang error.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, msg: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, msg: (error && error.message) ? error.message : String(error) };
  }
  componentDidCatch(error, info) {
    console.error('CostLab error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-white font-sans">
          <div className="max-w-sm text-center">
            <div className="text-5xl mb-3">⚠️</div>
            <h1 className="text-xl font-black mb-2">Terjadi gangguan sementara</h1>
            <p className="text-sm opacity-70 mb-5">Aplikasi menemui kendala saat memuat halaman ini. Silakan muat ulang.</p>
            <button onClick={() => window.location.reload()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold">Muat Ulang</button>
            <p className="text-[10px] opacity-40 mt-4 break-words font-mono">{this.state.msg}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
