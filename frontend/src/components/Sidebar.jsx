import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Pill, 
  CalendarClock, 
  History, 
  Cpu, 
  Tv, 
  User,
  HeartPulse
} from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Medicines', path: '/medicines', icon: Pill },
    { name: 'Schedules', path: '/schedules', icon: CalendarClock },
    { name: 'History', path: '/history', icon: History },
    { name: 'Device Status', path: '/device', icon: Cpu },
    { name: 'ESP32 Simulator', path: '/simulator', icon: Tv },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <HeartPulse size={28} color="#0d9488" />
        <div className="sidebar-brand">MedReminder</div>
      </div>
      <nav className="sidebar-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={item.path === '/'}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
