import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { SideNav } from './SideNav';
import { useAuth } from '../../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { idleWarning, resetIdleTimer, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!idleWarning) { setCountdown(60); return; }
    setCountdown(60);
    const interval = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(interval);
  }, [idleWarning]);

  const handleLogoutNow = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0a0a0a' }}>
      <SideNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile header */}
        <header
          className="md:hidden flex items-center gap-3 px-4 py-3 shrink-0"
          style={{
            backgroundColor: '#111111',
            borderBottom: '1px solid #2d2d2d',
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white hover:text-white p-1"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <img
            src="/wiz3d_prints_logo.png"
            alt="Wiz3D Prints"
            style={{ width: 32, height: 32, objectFit: 'contain' }}
          />
          <span className="text-sm font-bold text-white">Wiz3d Tools</span>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <footer
          className="py-3 border-t text-center text-xs text-white"
          style={{ backgroundColor: '#111111', borderColor: '#2d2d2d' }}
        >
          Wiz3d Tools — 3D Printing Business Suite
        </footer>
      </div>

      {/* Idle timeout modal */}
      {idleWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div className="card p-8 max-w-sm w-full mx-4 text-center" style={{ border: '1px solid #e68a00' }}>
            <div className="text-4xl mb-3">⏱</div>
            <h2 className="text-lg font-semibold text-white mb-2">Session Expiring</h2>
            <p className="text-white text-sm mb-6">
              You've been idle. You'll be signed out in{' '}
              <span className="text-[#ff9900] font-bold">{countdown}s</span>.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={resetIdleTimer} className="btn-primary px-6 py-2 text-sm">
                Stay Signed In
              </button>
              <button onClick={handleLogoutNow} className="btn-secondary px-6 py-2 text-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
