import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // Tailwind / styling WELP
import { Mascot, AppSymbol } from './brand.jsx';

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
    console.error('WELP error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-chrome-deep text-white font-sans">
          <div className="max-w-sm text-center">
            <Mascot pose="lelah" className="w-24 h-24 object-contain mx-auto mb-4" alt="" />
            <h1 className="font-display text-xl font-extrabold mb-2">Welp, ada yang macet</h1>
            <p className="text-sm opacity-70 mb-5">Aplikasi menemui kendala saat memuat halaman ini. Coba muat ulang, ya.</p>
            <button onClick={() => window.location.reload()} className="bg-flame-500 hover:bg-flame-400 text-white px-6 py-3 rounded-2xl font-extrabold">Muat Ulang</button>
            <p className="text-[10px] opacity-40 mt-4 break-words font-mono">{this.state.msg}</p>
            <div className="mt-6 flex justify-center"><AppSymbol className="w-8 h-8 opacity-60" /></div>
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
