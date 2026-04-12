import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, X, BarChart2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type Props = { open: boolean; onClose: () => void };

function NavIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="w-14 h-[42px] shrink-0 flex items-center justify-center">
      <img src={src} alt={alt} className="w-full h-full object-contain mix-blend-screen" />
    </span>
  );
}

function NavItem({
  to,
  label,
  iconSrc,
  exact,
  onClick,
  fallbackIcon,
}: {
  to: string;
  label: string;
  iconSrc?: string;
  exact?: boolean;
  onClick?: () => void;
  fallbackIcon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center">
      {iconSrc ? (
        <NavIcon src={iconSrc} alt={label} />
      ) : (
        <span className="w-14 h-[42px] shrink-0 flex items-center justify-center" style={{ color: '#6b7280' }}>
          {fallbackIcon}
        </span>
      )}
      <NavLink
        to={to}
        end={exact}
        onClick={onClick}
        className={({ isActive }) =>
          `flex-1 py-1.5 pr-3 text-xs rounded-md transition-colors ${isActive ? '' : ''}`
        }
        style={({ isActive }) => ({
          color: '#ffffff',
          backgroundColor: isActive ? '#ff9900' : 'transparent',
          fontWeight: isActive ? 600 : 400,
          paddingLeft: '0.5rem',
          borderLeft: isActive ? '2px solid #e68a00' : '2px solid transparent',
        })}
      >
        {label}
      </NavLink>
    </div>
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
      {/* Sidebar */}
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
          <NavItem to="/" label="Dashboard" iconSrc="/icons/dashboard.png" exact onClick={onClose} />

          <SectionHeader label="Operations" sectionKey="operations" open={sections.operations} onToggle={toggleSection} />
          {sections.operations && (
            <>
              <NavItem to="/queue" label="Queue" iconSrc="/icons/queue.png" onClick={onClose} />
              <NavItem to="/printers" label="Printers" iconSrc="/icons/printers.png" onClick={onClose} />
              <NavItem to="/customers" label="Customers" iconSrc="/icons/customers.png" onClick={onClose} />
              <NavItem to="/products" label="Products" iconSrc="/icons/products.png" onClick={onClose} />
              <NavItem to="/invoices" label="Invoices" iconSrc="/icons/invoices.png" onClick={onClose} />
              <NavItem
                to="/reports/sales"
                label="Sales Report"
                fallbackIcon={<BarChart2 size={15} />}
                onClick={onClose}
              />
            </>
          )}

          <SectionHeader label="Filament" sectionKey="filament" open={sections.filament} onToggle={toggleSection} />
          {sections.filament && (
            <>
              <NavItem to="/filament" label="Inventory" iconSrc="/icons/filament-inventory.png" onClick={onClose} />
              {isAdmin && (
                <NavItem to="/admin/manufacturers" label="Manufacturers" iconSrc="/icons/filament-manufacturers.png" onClick={onClose} />
              )}
            </>
          )}

          {isAdmin && (
            <>
              <SectionHeader label="Admin" sectionKey="admin" open={sections.admin} onToggle={toggleSection} />
              {sections.admin && (
                <>
                  <NavItem to="/admin/users" label="Users" iconSrc="/icons/user-administration.png" onClick={onClose} />
                  <NavItem to="/admin/colors" label="Colors" iconSrc="/icons/filament-color-administration.png" onClick={onClose} />
                  <NavItem to="/admin/printers" label="Printers" iconSrc="/icons/printer-administration.png" onClick={onClose} />
                </>
              )}
            </>
          )}
        </nav>

        {/* Footer — user info + sign out */}
        <div className="shrink-0 py-3" style={{ borderTop: '1px solid #2d2d2d' }}>
          {user && (
            <div className="px-4 py-1 flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: '#6b7280' }}>{user.username}</span>
              <span className="text-xs font-medium" style={{ color: '#ff9900' }}>v{__APP_VERSION__}</span>
            </div>
          )}
          <div className="flex items-center">
            <NavIcon src="/icons/sign-out.png" alt="Sign Out" />
            <button
              onClick={handleLogout}
              className="flex-1 py-1.5 pr-3 text-sm rounded-md transition-colors text-left"
              style={{
                color: '#ffffff',
                paddingLeft: '0.5rem',
                borderLeft: '2px solid transparent',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
