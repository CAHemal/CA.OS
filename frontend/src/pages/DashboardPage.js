import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Users, ListTodo, Clock, CalendarDays, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

const priorityColors = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/dashboard/stats');
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Staff', value: stats.total_employees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Tasks', value: stats.active_tasks, icon: ListTodo, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Present Today', value: stats.present_today, icon: Clock, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending Leaves', value: stats.pending_leaves, icon: CalendarDays, color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  const chartData = stats.weekly_attendance.map(d => ({
    ...d,
    day: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })
  }));

  return (
    <div data-testid="dashboard-page" className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground mt-1">Here's an overview of your office today</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map(card => (
          <Card key={card.label} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-3xl font-bold font-heading mt-1 tabular-nums">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <card.icon size={22} className={card.color} strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Tasks */}
        <Card className="lg:col-span-8 border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <ListTodo size={18} className="text-blue-600" />
              Recent Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recent_tasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No tasks yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-medium">Task</TableHead>
                    <TableHead className="font-medium">Assignee</TableHead>
                    <TableHead className="font-medium">Priority</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium">Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent_tasks.map(task => (
                    <TableRow key={task.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">{task.title}</TableCell>
                      <TableCell className="text-muted-foreground">{task.assigned_to_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${priorityColors[task.priority]} border-0 text-xs`}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`${statusColors[task.status]} border-0 text-xs`}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Weekly Attendance Chart */}
        <Card className="lg:col-span-4 border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" />
              Weekly Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="present" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
