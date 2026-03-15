import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { useAuth } from '../../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  onUploadClick?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onUploadClick }) => {
  const { idleWarning, resetIdleTimer, logout } = useAuth();
  const navigate = useNavigate();
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

  const handleStayLoggedIn = () => {
    resetIdleTimer();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0a0a0a' }}>
      <Header onUploadClick={onUploadClick} />

      {idleWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div className="card p-8 max-w-sm w-full mx-4 text-center" style={{ border: '1px solid #e68a00' }}>
            <div className="text-4xl mb-3">⏱</div>
            <h2 className="text-lg font-semibold text-iron-50 mb-2">Session Expiring</h2>
            <p className="text-iron-400 text-sm mb-6">
              You've been idle. You'll be signed out in{' '}
              <span className="text-[#ff9900] font-bold">{countdown}s</span>.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleStayLoggedIn} className="btn-primary px-6 py-2 text-sm">
                Stay Signed In
              </button>
              <button onClick={handleLogoutNow} className="btn-secondary px-6 py-2 text-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer
        className="py-4 border-t"
        style={{ backgroundColor: '#1a1a1a', borderColor: '#2d2d2d' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-iron-400">
          Wiz3d Tools — 3D Printing Business Suite
        </div>
      </footer>
    </div>
  );
};
