import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, Search, MoreHorizontal, Filter } from 'lucide-react';
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

export default function TasksPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', client_id: '', priority: 'medium', due_date: '' });

  const fetchTasks = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      const { data } = await api.get('/tasks', { params });
      setTasks(data);
    } catch (err) { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [statusFilter, priorityFilter]);

  const fetchMeta = useCallback(async () => {
    try {
      const [empRes, clientRes] = await Promise.all([api.get('/employees'), api.get('/clients')]);
      setEmployees(empRes.data);
      setClients(clientRes.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { if (isManager) fetchMeta(); }, [isManager, fetchMeta]);

  const handleCreate = async () => {
    if (!form.title || !form.assigned_to) { toast.error('Title and assignee are required'); return; }
    try {
      await api.post('/tasks', form);
      toast.success('Task created');
      setShowCreate(false);
      setForm({ title: '', description: '', assigned_to: '', client_id: '', priority: 'medium', due_date: '' });
      fetchTasks();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create task'); }
  };

  const updateStatus = async (taskId, status) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status });
      toast.success('Status updated');
      fetchTasks();
    } catch (err) { toast.error('Failed to update status'); }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      toast.success('Task deleted');
      fetchTasks();
    } catch (err) { toast.error('Failed to delete task'); }
  };

  const filtered = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.assigned_to_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div data-testid="tasks-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and track task assignments</p>
        </div>
        {isManager && (
          <Button data-testid="create-task-btn" onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus size={16} className="mr-2" /> New Task
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input data-testid="task-search" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="task-status-filter" className="w-full sm:w-40">
                <Filter size={14} className="mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger data-testid="task-priority-filter" className="w-full sm:w-40">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No tasks found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-medium">Task</TableHead>
                  <TableHead className="font-medium">Assignee</TableHead>
                  <TableHead className="font-medium">Client</TableHead>
                  <TableHead className="font-medium">Priority</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium">Due Date</TableHead>
                  <TableHead className="font-medium">Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(task => (
                  <TableRow key={task.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{task.assigned_to_name}</TableCell>
                    <TableCell className="text-muted-foreground">{task.client_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${priorityColors[task.priority]} border-0 text-xs`}>{task.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${statusColors[task.status]} border-0 text-xs`}>{task.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {task.due_date ? new Date(task.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums text-xs">
                      {new Date(task.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button data-testid={`task-actions-${task.id}`} variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {task.status !== 'in_progress' && <DropdownMenuItem onClick={() => updateStatus(task.id, 'in_progress')}>Mark In Progress</DropdownMenuItem>}
                          {task.status !== 'completed' && <DropdownMenuItem onClick={() => updateStatus(task.id, 'completed')}>Mark Complete</DropdownMenuItem>}
                          {task.status !== 'pending' && <DropdownMenuItem onClick={() => updateStatus(task.id, 'pending')}>Mark Pending</DropdownMenuItem>}
                          {isManager && <DropdownMenuItem className="text-red-600" onClick={() => deleteTask(task.id)}>Delete</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input data-testid="task-title-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Task title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea data-testid="task-desc-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Task description" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select value={form.assigned_to} onValueChange={v => setForm({...form, assigned_to: v})}>
                  <SelectTrigger data-testid="task-assignee-select"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.is_active).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Client (Optional)</Label>
                <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v})}>
                  <SelectTrigger data-testid="task-client-select"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No client</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                  <SelectTrigger data-testid="task-priority-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input data-testid="task-due-date" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button data-testid="task-submit-btn" onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">Create Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
