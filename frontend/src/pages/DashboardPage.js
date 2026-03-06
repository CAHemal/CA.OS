import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Users, ListTodo, Clock, CalendarDays, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '@/lib/api';

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800',
  overdue: 'bg-red-100 text-red-800',
};

const priorityColors = {
  low: 'bg-zinc-100 text-zinc-700',
  medium: 'bg-indigo-100 text-indigo-700',
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
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Staff', value: stats.total_employees, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', accent: 'border-l-indigo-500' },
    { label: 'Active Tasks', value: stats.active_tasks, icon: ListTodo, color: 'text-amber-600', bg: 'bg-amber-50', accent: 'border-l-amber-500' },
    { label: 'Present Today', value: stats.present_today, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50', accent: 'border-l-emerald-500' },
    { label: 'Pending Leaves', value: stats.pending_leaves, icon: CalendarDays, color: 'text-rose-600', bg: 'bg-rose-50', accent: 'border-l-rose-500' },
  ];

  const chartData = stats.weekly_attendance.map(d => ({
    ...d,
    day: new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short' })
  }));

  return (
    <div data-testid="dashboard-page" className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Here's an overview of your office today</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 stagger-children">
        {statCards.map(card => (
          <Card key={card.label} className={`border-zinc-200 shadow-sm hover:shadow-md transition-shadow duration-200 border-l-4 ${card.accent}`}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold font-heading mt-1 tabular-nums">{card.value}</p>
                </div>
                <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <card.icon size={18} className={`${card.color} sm:hidden`} strokeWidth={1.5} />
                  <card.icon size={22} className={`${card.color} hidden sm:block`} strokeWidth={1.5} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Recent Tasks */}
        <Card className="lg:col-span-8 border-zinc-200 shadow-sm">
          <CardHeader className="border-b border-zinc-100 pb-4">
            <CardTitle className="text-base sm:text-lg font-heading flex items-center gap-2">
              <ListTodo size={18} className="text-indigo-600" />
              Recent Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recent_tasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No tasks yet</div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50/50">
                        <TableHead className="font-medium">Task</TableHead>
                        <TableHead className="font-medium">Assignee</TableHead>
                        <TableHead className="font-medium">Priority</TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                        <TableHead className="font-medium">Due</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recent_tasks.map(task => (
                        <TableRow key={task.id} className="hover:bg-zinc-50/50">
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell className="text-muted-foreground">{task.assigned_to_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`${priorityColors[task.priority]} border-0 text-xs`}>{task.priority}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`${statusColors[task.status]} border-0 text-xs`}>{task.status.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground tabular-nums">
                            {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile Card View */}
                <div className="sm:hidden divide-y divide-zinc-100">
                  {stats.recent_tasks.map(task => (
                    <div key={task.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-sm">{task.title}</p>
                        <Badge variant="secondary" className={`${statusColors[task.status]} border-0 text-[10px] shrink-0 ml-2`}>{task.status.replace('_', ' ')}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{task.assigned_to_name}</span>
                        <Badge variant="secondary" className={`${priorityColors[task.priority]} border-0 text-[10px]`}>{task.priority}</Badge>
                        {task.due_date && <span className="tabular-nums">{new Date(task.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Weekly Attendance Chart */}
        <Card className="lg:col-span-4 border-zinc-200 shadow-sm">
          <CardHeader className="border-b border-zinc-100 pb-4">
            <CardTitle className="text-base sm:text-lg font-heading flex items-center gap-2">
              <CheckCircle size={18} className="text-emerald-600" />
              Weekly Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#A1A1AA" />
                <YAxis tick={{ fontSize: 12 }} stroke="#A1A1AA" />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #E4E4E7',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="present" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
