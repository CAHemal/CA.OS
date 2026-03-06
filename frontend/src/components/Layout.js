import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, ListTodo, Clock, CalendarDays,
  Users, Building2, MessageSquare, Bell, LogOut, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger,
  DropdownMenuContent, DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import api from '@/lib/api';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/tasks', label: 'Tasks', icon: ListTodo },
  { path: '/attendance', label: 'Attendance', icon: Clock },
  { path: '/leaves', label: 'Leaves', icon: CalendarDays },
  { path: '/clients', label: 'Clients', icon: Building2 },
  { path: '/queries', label: 'Queries', icon: MessageSquare },
  { path: '/employees', label: 'Employees', icon: Users, roles: ['admin', 'manager'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (err) { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const filteredNav = navItems.filter(
    item => !item.roles || item.roles.includes(user?.role)
  );

  const handleLogout = () => { logout(); navigate('/login'); };
  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      fetchNotifications();
    } catch { /* silent */ }
  };

  const SidebarContent = ({ mobile = false }) => (
    <>
      <div className="flex items-center justify-between h-16 px-6 border-b border-slate-700/50">
        <span className="text-xl font-extrabold tracking-tight font-heading">CA.OS</span>
        {mobile && (
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {filteredNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => mobile && setSidebarOpen(false)}
              data-testid={`nav-${item.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
              }
            >
              <item.icon size={18} strokeWidth={1.5} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-600 text-white text-xs">{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-white">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
          <Button data-testid="logout-btn" variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={handleLogout}>
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:flex w-64 flex-col bg-[#0F172A] text-white flex-shrink-0">
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button data-testid="mobile-menu-btn" variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu size={20} />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="notifications-btn" variant="ghost" size="icon" className="relative">
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-3 border-b">
                  <h3 className="font-semibold text-sm font-heading">Notifications</h3>
                </div>
                <ScrollArea className="max-h-80">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
                  ) : (
                    notifications.slice(0, 10).map(n => (
                      <DropdownMenuItem key={n.id} onClick={() => markAsRead(n.id)} className={`cursor-pointer ${!n.is_read ? 'bg-blue-50' : ''}`}>
                        <div className="flex flex-col gap-1 py-1">
                          <span className="text-sm leading-snug">{n.message}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(n.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600 text-white text-xs">{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="text-right">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[#0F172A] text-white z-50 flex flex-col">
            <SidebarContent mobile />
          </aside>
        </div>
      )}
    </div>
  );
}
