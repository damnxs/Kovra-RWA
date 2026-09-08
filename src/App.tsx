import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { Markets } from './pages/Markets';
import { MarketDetail } from './pages/MarketDetail';
import { Docs } from './pages/Docs';
import { Dashboard } from './pages/Dashboard';
import { Watchlist } from './pages/Watchlist';
import { Activity } from './pages/Activity';
import { Agent } from './pages/Agent';
import { Trade } from './pages/Trade';
import { NotFound } from './pages/NotFound';
import { WalletProvider } from './data/WalletProvider';
import { OnchainProvider } from './data/OnchainProvider';

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Wait a frame for the routed section to mount.
      requestAnimationFrame(() => {
        document.querySelector(hash)?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <ScrollManager />
      <WalletProvider>
      <OnchainProvider>
        <Nav />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/markets/:id" element={<MarketDetail />} />
            <Route path="/trade/:id" element={<Trade />} />
            <Route path="/docs" element={<Docs />} />
            {/* Old About URL still resolves, it became the docs page. */}
            <Route path="/about" element={<Docs />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/agent" element={<Agent />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </OnchainProvider>
      </WalletProvider>
      <Footer />
    </div>
  );
}
