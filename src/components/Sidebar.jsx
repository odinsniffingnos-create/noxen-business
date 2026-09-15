import {
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  ChartColumn,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Customers', icon: Users },
  { label: 'Appointments', icon: CalendarClock },
  { label: 'Invoices', icon: BarChart3 },
  { label: 'Tasks', icon: BriefcaseBusiness },
  { label: 'Marketing', icon: Sparkles },
  { label: 'Analytics', icon: ChartColumn },
  { label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeSection, setActiveSection, currentPlan = 'Pro' }) {
  return (
    <aside className="sidebar glass-panel">
      <div className="brand-wrap">
        <div className="brand-mark">N</div>
        <div>
          <div className="brand-name">Noxen</div>
          <div className="brand-subtitle">Business</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={`nav-item ${activeSection === label ? 'active' : ''}`}
            onClick={() => setActiveSection(label)}
            type="button"
          >
            <span className="nav-pill">
              <Icon size={14} />
            </span>
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-card">
        <div className="mini-label">Current plan</div>
        <div className="mini-value">{currentPlan}</div>
        <div className="mini-trend positive">Billing active and synced</div>
      </div>
    </aside>
  );
}
