import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Sidebar as HomelabSidebar } from '@jdcpuwiz/homelab-ui';
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
    showcase: true,
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
    <HomelabSidebar
      logoSrc="/wiz3d_prints_logo.png"
      logoAlt="Wiz3D Prints"
      logoClassName="w-full h-auto object-contain mix-blend-screen"
      mobileOpen={open}
      onMobileOpenChange={(next) => { if (!next) onClose(); }}
      showMobileTopBar={false}
      middleClassName="flex-1 flex flex-col min-h-0 overflow-hidden"
      middle={
        <>
          {/* Sub-brand line under the logo block */}
          <div className="text-center pt-2 pb-1 shrink-0">
            <div className="text-sm font-bold leading-tight" style={{ color: '#ffffff' }}>Wiz3d Tools</div>
            <div className="text-xs leading-tight" style={{ color: '#6b7280' }}>3D Printing Suite</div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3">
            <NavItem to="/" label="Dashboard" exact onClick={onClose} />

            <SectionHeader label="Operations" sectionKey="operations" open={sections.operations} onToggle={toggleSection} />
            {sections.operations && (
              <>
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
                <SectionHeader label="Showcase" sectionKey="showcase" open={sections.showcase} onToggle={toggleSection} />
                {sections.showcase && (
                  <>
                    <NavItem to="/admin/showcase/portfolio" label="Portfolio" onClick={onClose} />
                    <NavItem to="/admin/showcase/services" label="Services" onClick={onClose} />
                    <NavItem to="/admin/showcase/materials" label="Materials" onClick={onClose} />
                    <NavItem to="/admin/showcase/testimonials" label="Testimonials" onClick={onClose} />
                    <NavItem to="/admin/showcase/about" label="About" onClick={onClose} />
                  </>
                )}
                <SectionHeader label="Admin" sectionKey="admin" open={sections.admin} onToggle={toggleSection} />
                {sections.admin && (
                  <>
                    <NavItem to="/admin/users" label="Users" onClick={onClose} />
                    <NavItem to="/admin/colors" label="Colors" onClick={onClose} />
                    <NavItem to="/admin/categories" label="Categories" onClick={onClose} />
                  </>
                )}
              </>
            )}
          </nav>

          {/* Footer — homelab-canonical labeled pattern */}
          <div className="shrink-0 px-3 py-3" style={{ borderTop: '1px solid #2d2d2d' }}>
            {user && (
              <>
                <div className="text-[10px] uppercase tracking-widest text-white/40">
                  Signed in as
                </div>
                <div className="text-xs text-white truncate mt-0.5 font-medium">
                  {user.username}
                </div>
              </>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-left py-1.5 mt-2 px-2 text-sm rounded-md transition-colors hover:bg-white/5"
              style={{ color: '#ffffff', borderLeft: '2px solid transparent' }}
            >
              Sign Out
            </button>
            <div className="mt-3 pt-2 border-t text-[10px] font-mono tabular-nums text-white/30 flex items-center justify-between" style={{ borderColor: '#2d2d2d' }}>
              <span className="uppercase tracking-widest">Version</span>
              <span style={{ color: '#ff9900' }}>v{__APP_VERSION__}</span>
            </div>
          </div>
        </>
      }
    />
  );
};
