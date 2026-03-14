import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, ListTodo, Clock, CalendarDays,
  Users, Building2, MessageSquare, Bell, LogOut, Menu, X, MoreHorizontal, KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuTrigger,
  DropdownMenuContent, DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import ProfileDialog from '@/components/ProfileDialog';
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
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const filteredNav = navItems.filter(
    item => !item.roles || item.roles.includes(user?.role)
  );

  // Bottom nav: first 4 items + "More"
  const bottomNavItems = filteredNav.slice(0, 4);
  const moreNavItems = filteredNav.slice(4);

  const handleLogout = () => { logout(); navigate('/login'); };
  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      fetchNotifications();
    } catch { /* silent */ }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col bg-white border-r border-zinc-200 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm font-heading">CA</span>
            </div>
            <span className="text-lg font-bold tracking-tight font-heading text-zinc-900">CA.OS</span>
          </div>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-3">
          <div className="px-3 mb-2">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Main</p>
          </div>
          <nav className="space-y-0.5 px-3">
            {filteredNav.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-indigo-50 text-indigo-700 border-l-[3px] border-l-indigo-600 ml-0'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`
                }
              >
                <item.icon size={18} strokeWidth={1.5} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </ScrollArea>

        {/* User */}
        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowProfile(true)} className="shrink-0" data-testid="sidebar-profile-btn">
              <Avatar className="h-9 w-9 ring-2 ring-indigo-100 hover:ring-indigo-300 transition-all cursor-pointer">
                <AvatarFallback className="bg-indigo-600 text-white text-xs font-semibold">{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
            </button>
            <button onClick={() => setShowProfile(true)} className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold truncate text-zinc-900 hover:text-indigo-600 transition-colors">{user?.name}</p>
              <p className="text-xs text-zinc-400 capitalize">{user?.role}</p>
            </button>
            <div className="flex gap-1">
              <Button data-testid="change-password-btn" variant="ghost" size="icon" className="text-zinc-400 hover:text-indigo-600 h-8 w-8" onClick={() => setShowChangePassword(true)} title="Change Password">
                <KeyRound size={15} />
              </Button>
              <Button data-testid="logout-btn" variant="ghost" size="icon" className="text-zinc-400 hover:text-red-500 h-8 w-8" onClick={handleLogout}>
                <LogOut size={15} />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50">
        {/* Top Header */}
        <header className="h-14 lg:h-16 flex items-center justify-between px-4 lg:px-6 bg-white border-b border-zinc-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs font-heading">CA</span>
              </div>
              <span className="text-base font-bold tracking-tight font-heading text-zinc-900">CA.OS</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="notifications-btn" variant="ghost" size="icon" className="relative h-9 w-9">
                  <Bell size={18} className="text-zinc-500" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-medium">
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
                      <DropdownMenuItem key={n.id} onClick={() => markAsRead(n.id)} className={`cursor-pointer ${!n.is_read ? 'bg-indigo-50' : ''}`}>
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

            {/* Desktop user badge */}
            <button onClick={() => setShowProfile(true)} className="hidden lg:flex items-center gap-2.5 pl-2 ml-1 border-l border-zinc-200 hover:opacity-80 transition-opacity" data-testid="header-profile-btn">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-indigo-600 text-white text-xs">{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium text-zinc-900">{user?.name}</p>
                <p className="text-[11px] text-zinc-400 capitalize">{user?.role}</p>
              </div>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 z-50 safe-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {bottomNavItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5"
              >
                <item.icon
                  size={20}
                  strokeWidth={isActive ? 2 : 1.5}
                  className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-zinc-400'}`}
                />
                <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-indigo-600' : 'text-zinc-400'}`}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* More button */}
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                data-testid="mobile-nav-more"
                className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5"
              >
                <MoreHorizontal size={20} strokeWidth={1.5} className="text-zinc-400" />
                <span className="text-[10px] font-medium text-zinc-400">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader className="pb-2">
                <SheetTitle className="font-heading text-left">Menu</SheetTitle>
              </SheetHeader>
              <div className="space-y-1 py-2">
                {moreNavItems.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all
                        ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50'}`}
                    >
                      <item.icon size={20} strokeWidth={1.5} />
                      {item.label}
                    </NavLink>
                  );
                })}
                <div className="border-t border-zinc-100 mt-3 pt-3">
                  <button
                    onClick={() => { setMoreOpen(false); setShowProfile(true); }}
                    className="flex items-center gap-3 px-3 py-2 w-full"
                    data-testid="mobile-profile-btn"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-indigo-600 text-white text-xs">{getInitials(user?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-zinc-900">{user?.name}</p>
                      <p className="text-xs text-zinc-400 capitalize">{user?.role}</p>
                    </div>
                  </button>
                  <button
                    data-testid="mobile-change-pw-btn"
                    onClick={() => { setMoreOpen(false); setShowChangePassword(true); }}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 w-full transition-all"
                  >
                    <KeyRound size={20} strokeWidth={1.5} /> Change Password
                  </button>
                  <button
                    data-testid="mobile-logout-btn"
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-all"
                  >
                    <LogOut size={20} strokeWidth={1.5} /> Sign Out
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      <ChangePasswordDialog open={showChangePassword} onOpenChange={setShowChangePassword} />
      <ProfileDialog open={showProfile} onOpenChange={setShowProfile} />
    </div>
  );
}
