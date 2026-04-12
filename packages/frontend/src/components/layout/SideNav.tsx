import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type Props = { open: boolean; onClose: () => void };

function NavItem({
  to,
  label,
  exact,
  onClick,
}: {
  to: string;
  label: string;
  exact?: boolean;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={exact}
      onClick={onClick}
      className={({ isActive }) =>
        `block py-1.5 px-4 mx-2 text-sm rounded-md transition-colors ${isActive ? '' : ''}`
      }
      style={({ isActive }) => ({
        color: '#ffffff',
        backgroundColor: isActive ? '#ff9900' : 'transparent',
        fontWeight: isActive ? 600 : 400,
        borderLeft: isActive ? '2px solid #e68a00' : '2px solid transparent',
      })}
    >
      {label}
    </NavLink>
  );
}

function SectionHeader({
  label,
  sectionKey,
  open,
  onToggle,
}: {
  label: string;
  sectionKey: string;
  open: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(sectionKey)}
      className="w-full flex items-center gap-2 mt-5 mb-1 pr-4 hover:opacity-80 transition-opacity"
      style={{ paddingLeft: '0.75rem' }}
    >
      <span className="text-xs font-bold uppercase tracking-wider shrink-0" style={{ color: '#ff9900' }}>
        {label}
      </span>
      <div className="flex-1 h-px" style={{ backgroundColor: '#2d2d2d' }} />
      <ChevronDown
        size={12}
        className="shrink-0 transition-transform duration-200"
        style={{ color: '#6b7280', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
      />
    </button>
  );
}

export const SideNav: React.FC<Props> = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [sections, setSections] = useState<Record<string, boolean>>({
    operations: true,
    filament: true,
    admin: true,
  });

  function toggleSection(key: string) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex flex-col w-64 shrink-0',
          'md:static md:z-auto md:translate-x-0 md:h-screen md:sticky md:top-0',
          'transition-transform duration-200 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ backgroundColor: '#111111', borderRight: '1px solid #2d2d2d' }}
      >
        {/* Header — full-width logo + text below */}
        <div
          className="relative px-3 pt-4 pb-3 shrink-0"
          style={{ borderBottom: '1px solid #2d2d2d' }}
        >
          <button
            className="md:hidden absolute top-3 right-2 text-iron-400 hover:text-iron-200 p-1"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
          <img
            src="/wiz3d_prints_logo.png"
            alt="Wiz3D Prints"
            className="w-full h-auto object-contain mix-blend-screen"
          />
          <div className="text-center mt-2">
            <div className="text-sm font-bold leading-tight" style={{ color: '#ffffff' }}>Wiz3d Tools</div>
            <div className="text-xs leading-tight" style={{ color: '#6b7280' }}>3D Printing Suite</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3">
          <NavItem to="/" label="Dashboard" exact onClick={onClose} />

          <SectionHeader label="Operations" sectionKey="operations" open={sections.operations} onToggle={toggleSection} />
          {sections.operations && (
            <>
              <NavItem to="/queue" label="Queue" onClick={onClose} />
              <NavItem to="/printers" label="Printers" onClick={onClose} />
              <NavItem to="/customers" label="Customers" onClick={onClose} />
              <NavItem to="/products" label="Products" onClick={onClose} />
              <NavItem to="/invoices" label="Invoices" onClick={onClose} />
            </>
          )}

          <SectionHeader label="Filament" sectionKey="filament" open={sections.filament} onToggle={toggleSection} />
          {sections.filament && (
            <>
              <NavItem to="/filament" label="Inventory" onClick={onClose} />
              {isAdmin && (
                <NavItem to="/admin/manufacturers" label="Manufacturers" onClick={onClose} />
              )}
            </>
          )}

          {isAdmin && (
            <>
              <SectionHeader label="Admin" sectionKey="admin" open={sections.admin} onToggle={toggleSection} />
              {sections.admin && (
                <>
                  <NavItem to="/admin/users" label="Users" onClick={onClose} />
                  <NavItem to="/admin/colors" label="Colors" onClick={onClose} />
                  <NavItem to="/admin/printers" label="Printers" onClick={onClose} />
                  <NavItem to="/admin/categories" label="Categories" onClick={onClose} />
                </>
              )}
            </>
          )}
        </nav>

        {/* Footer — user info + sign out */}
        <div className="shrink-0 px-2 py-3" style={{ borderTop: '1px solid #2d2d2d' }}>
          {user && (
            <div className="px-2 py-1 flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: '#6b7280' }}>{user.username}</span>
              <span className="text-xs font-medium" style={{ color: '#ff9900' }}>v{__APP_VERSION__}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left py-1.5 px-2 text-sm rounded-md transition-colors"
            style={{ color: '#ffffff', borderLeft: '2px solid transparent' }}
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
