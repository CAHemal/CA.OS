import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

import {
  LayoutDashboard as LayoutDashboardIcon,
  ListTodo,
  Clock,
  CalendarDays,
  Users,
  Building2,
  MessageSquare,
  Bell,
  LogOut,
  Menu,
  X,
  MoreHorizontal,
  KeyRound,
  FileText
} from 'lucide-react';

import api from '@/lib/api';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { path: '/tasks', label: 'Tasks', icon: ListTodo },
  { path: '/attendance', label: 'Attendance', icon: Clock },
  { path: '/leaves', label: 'Leaves', icon: CalendarDays },
  { path: '/clients', label: 'Clients', icon: Building2 },
  { path: '/queries', label: 'Queries', icon: MessageSquare },
  { path: '/daily-reports', label: 'Daily Reports', icon: FileText },
  { path: '/employees', label: 'Employees', icon: Users, roles: ['admin', 'manager'] },
];
