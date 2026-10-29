import { Link } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="wt-navbar sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3" aria-label="Main">
        <Link to="/" className="flex items-center gap-2 rounded text-lg font-semibold text-white focus-visible:ring-2 focus-visible:ring-blue-400">
          <Clapperboard className="h-5 w-5 text-blue-400" aria-hidden="true" />
          WatchTogether
        </Link>
        <div className="flex items-center gap-4 text-sm text-slate-300">
          <a href="/#features" className="hidden rounded hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400 sm:inline">Features</a>
          <a href="/#start" className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-500 focus-visible:ring-2 focus-visible:ring-blue-300">Start</a>
        </div>
      </nav>
    </header>
  );
}
