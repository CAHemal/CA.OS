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
import { toast } from 'sonner';
import { Plus, FileText, Clock, CheckCircle, Trash2, Edit, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import api from '@/lib/api';

export default function DailyReportsPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [reports, setReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingReport, setEditingReport] = useState(null);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    tasks_completed: [{ title: '', hours: '', description: '' }],
    total_hours: 0,
    summary: '',
  });

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (filterEmployee !== 'all') params.user_id = filterEmployee;
      const { data } = await api.get('/daily-reports', { params });
      setReports(data);
    } catch (err) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, filterEmployee]);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await api.get('/employees');
      setEmployees(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { if (isManager) fetchEmployees(); }, [isManager, fetchEmployees]);

  // Fetch existing report when opening create dialog
  const openCreateDialog = async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data } = await api.get(`/daily-reports/my/${today}`);
      if (data && data.id) {
        setForm({
          date: data.date,
          tasks_completed: data.tasks_completed.length > 0 ? data.tasks_completed : [{ title: '', hours: '', description: '' }],
          total_hours: data.total_hours,
          summary: data.summary,
        });
        setEditingReport(data);
      } else {
        setForm({
          date: today,
          tasks_completed: [{ title: '', hours: '', description: '' }],
          total_hours: 0,
          summary: '',
        });
        setEditingReport(null);
      }
    } catch {
      setForm({
        date: today,
        tasks_completed: [{ title: '', hours: '', description: '' }],
        total_hours: 0,
        summary: '',
      });
      setEditingReport(null);
    }
    setShowCreate(true);
  };

  // Task row management
  const addTaskRow = () => {
    setForm({ ...form, tasks_completed: [...form.tasks_completed, { title: '', hours: '', description: '' }] });
  };

  const removeTaskRow = (index) => {
    if (form.tasks_completed.length <= 1) return;
    const updated = form.tasks_completed.filter((_, i) => i !== index);
    const totalHours = updated.reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);
    setForm({ ...form, tasks_completed: updated, total_hours: totalHours });
  };

  const updateTaskRow = (index, field, value) => {
    const updated = [...form.tasks_completed];
    updated[index] = { ...updated[index], [field]: value };
    const totalHours = updated.reduce((sum, t) => sum + (parseFloat(t.hours) || 0), 0);
    setForm({ ...form, tasks_completed: updated, total_hours: totalHours });
  };

  // Submit report
  const handleSubmit = async () => {
    const validTasks = form.tasks_completed.filter(t => t.title.trim());
    if (validTasks.length === 0) {
      toast.error('Add at least one task');
      return;
    }
    try {
      await api.post('/daily-reports', {
        date: form.date,
        tasks_completed: validTasks,
        total_hours: form.total_hours,
        summary: form.summary,
      });
      toast.success(editingReport ? 'Report updated' : 'Report submitted');
      setShowCreate(false);
      setEditingReport(null);
      fetchReports();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit report');
    }
  };

  // Date navigation
  const navigateDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div data-testid="daily-reports-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight">Daily Reports</h1>
          <p className="text-muted-foreground mt-1 text-sm">Track daily work and hours logged</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
          <Plus size={16} className="mr-2" /> {editingReport ? 'Update Today\'s Report' : 'Submit Report'}
        </Button>
      </div>

      {/* Date Navigation & Filters */}
      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(-1)}>
                <ChevronLeft size={16} />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-muted-foreground" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigateDate(1)}>
                <ChevronRight size={16} />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday} className="text-xs">
                Today
              </Button>
            </div>
            <div className="text-sm font-medium text-muted-foreground">
              {formatDate(selectedDate)}
            </div>
            {isManager && (
              <div className="sm:ml-auto w-full sm:w-48">
                <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.filter(e => e.is_active).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <FileText size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports.length}</p>
              <p className="text-xs text-muted-foreground">Reports</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Clock size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports.reduce((sum, r) => sum + (r.total_hours || 0), 0).toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <CheckCircle size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reports.reduce((sum, r) => sum + (r.tasks_completed?.length || 0), 0)}</p>
              <p className="text-xs text-muted-foreground">Tasks Done</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>No reports for {formatDate(selectedDate)}</p>
              <p className="text-xs mt-1">Click "Submit Report" to add today's work</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50/50">
                      {isManager && <TableHead className="font-medium">Employee</TableHead>}
                      <TableHead className="font-medium">Date</TableHead>
                      <TableHead className="font-medium">Tasks Completed</TableHead>
                      <TableHead className="font-medium">Hours</TableHead>
                      <TableHead className="font-medium">Summary</TableHead>
                      <TableHead className="font-medium">Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map(report => (
                      <TableRow key={report.id} className="hover:bg-zinc-50/50">
                        {isManager && (
                          <TableCell className="font-medium">{report.user_name}</TableCell>
                        )}
                        <TableCell className="text-muted-foreground tabular-nums">
                          {new Date(report.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {report.tasks_completed?.map((task, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                                <span>{task.title}</span>
                                {task.hours && (
                                  <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-0 text-[10px]">
                                    {task.hours}h
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-0">
                            {report.total_hours}h
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                          {report.summary || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums text-xs">
                          {report.submitted_at ? new Date(report.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-zinc-100">
                {reports.map(report => (
                  <div key={report.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        {isManager && <p className="font-medium text-sm">{report.user_name}</p>}
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-0">
                        {report.total_hours}h
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {report.tasks_completed?.map((task, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          <span className="text-sm">{task.title}</span>
                          {task.hours && <span className="text-xs text-muted-foreground ml-auto">{task.hours}h</span>}
                        </div>
                      ))}
                    </div>
                    {report.summary && (
                      <p className="text-xs text-muted-foreground border-t border-zinc-100 pt-2">{report.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Report Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingReport ? 'Update Daily Report' : 'Submit Daily Report'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Date */}
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>

            {/* Tasks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tasks Completed</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTaskRow} className="text-xs h-7">
                  <Plus size={12} className="mr-1" /> Add Task
                </Button>
              </div>
              <div className="space-y-3">
                {form.tasks_completed.map((task, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Task title"
                        value={task.title}
                        onChange={e => updateTaskRow(index, 'title', e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Hours"
                          value={task.hours}
                          onChange={e => updateTaskRow(index, 'hours', e.target.value)}
                          className="w-24"
                          step="0.5"
                          min="0"
                        />
                        <Input
                          placeholder="Brief description (optional)"
                          value={task.description}
                          onChange={e => updateTaskRow(index, 'description', e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    {form.tasks_completed.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-500 hover:text-red-700 shrink-0 mt-0.5"
                        onClick={() => removeTaskRow(index)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Total Hours */}
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
              <Clock size={16} className="text-indigo-600" />
              <span className="text-sm font-medium">Total Hours:</span>
              <span className="text-lg font-bold text-indigo-700">{form.total_hours.toFixed(1)}h</span>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label>Summary / Notes</Label>
              <Textarea
                value={form.summary}
                onChange={e => setForm({ ...form, summary: e.target.value })}
                placeholder="Brief summary of the day's work..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700">
              {editingReport ? 'Update Report' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
