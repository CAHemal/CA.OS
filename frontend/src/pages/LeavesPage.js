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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, CalendarDays, Check, X } from 'lucide-react';
import api from '@/lib/api';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const leaveTypeLabels = {
  casual: 'Casual',
  sick: 'Sick',
  earned: 'Earned',
  unpaid: 'Unpaid',
};

export default function LeavesPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
  const [activeTab, setActiveTab] = useState('my-leaves');

  const fetchLeaves = useCallback(async () => {
    try {
      const { data } = await api.get('/leaves');
      setLeaves(data);
    } catch { toast.error('Failed to load leaves'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const handleApply = async () => {
    if (!form.start_date || !form.end_date) { toast.error('Start and end dates are required'); return; }
    try {
      await api.post('/leaves', form);
      toast.success('Leave application submitted');
      setShowApply(false);
      setForm({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
      fetchLeaves();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to apply leave'); }
  };

  const handleAction = async (leaveId, action) => {
    try {
      await api.put(`/leaves/${leaveId}/${action}`);
      toast.success(`Leave ${action}d`);
      fetchLeaves();
    } catch (err) { toast.error(`Failed to ${action} leave`); }
  };

  const myLeaves = leaves.filter(l => l.user_id === user?.id);
  const pendingApprovals = leaves.filter(l => l.status === 'pending' && l.user_id !== user?.id);

  const LeaveTable = ({ data, showActions = false, showEmployee = false }) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50/50">
          {showEmployee && <TableHead className="font-medium">Employee</TableHead>}
          <TableHead className="font-medium">Type</TableHead>
          <TableHead className="font-medium">From</TableHead>
          <TableHead className="font-medium">To</TableHead>
          <TableHead className="font-medium">Reason</TableHead>
          <TableHead className="font-medium">Status</TableHead>
          {showActions && <TableHead className="font-medium">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map(l => (
          <TableRow key={l.id} className="hover:bg-slate-50/50">
            {showEmployee && <TableCell className="font-medium">{l.user_name}</TableCell>}
            <TableCell>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs">
                {leaveTypeLabels[l.leave_type] || l.leave_type}
              </Badge>
            </TableCell>
            <TableCell className="tabular-nums">{new Date(l.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
            <TableCell className="tabular-nums">{new Date(l.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
            <TableCell className="text-muted-foreground max-w-[200px] truncate">{l.reason || '-'}</TableCell>
            <TableCell>
              <Badge variant="secondary" className={`${statusColors[l.status]} border-0 text-xs`}>{l.status}</Badge>
            </TableCell>
            {showActions && (
              <TableCell>
                {l.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button data-testid={`approve-leave-${l.id}`} size="sm" variant="ghost" className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleAction(l.id, 'approve')}>
                      <Check size={14} className="mr-1" /> Approve
                    </Button>
                    <Button data-testid={`reject-leave-${l.id}`} size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleAction(l.id, 'reject')}>
                      <X size={14} className="mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div data-testid="leaves-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground mt-1">Apply for leaves and track approvals</p>
        </div>
        <Button data-testid="apply-leave-btn" onClick={() => setShowApply(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" /> Apply Leave
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger data-testid="my-leaves-tab" value="my-leaves">My Leaves</TabsTrigger>
          {isManager && (
            <TabsTrigger data-testid="pending-approvals-tab" value="approvals">
              Pending Approvals
              {pendingApprovals.length > 0 && (
                <span className="ml-2 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {pendingApprovals.length}
                </span>
              )}
            </TabsTrigger>
          )}
          {isManager && <TabsTrigger data-testid="all-leaves-tab" value="all">All Leaves</TabsTrigger>}
        </TabsList>

        <TabsContent value="my-leaves">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
              ) : myLeaves.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No leave records</div>
              ) : (
                <LeaveTable data={myLeaves} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isManager && (
          <TabsContent value="approvals">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-0">
                {pendingApprovals.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No pending approvals</div>
                ) : (
                  <LeaveTable data={pendingApprovals} showActions showEmployee />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isManager && (
          <TabsContent value="all">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-0">
                {leaves.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No leave records</div>
                ) : (
                  <LeaveTable data={leaves} showEmployee />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Apply Leave Dialog */}
      <Dialog open={showApply} onOpenChange={setShowApply}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Apply for Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={form.leave_type} onValueChange={v => setForm({...form, leave_type: v})}>
                <SelectTrigger data-testid="leave-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="earned">Earned Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input data-testid="leave-start-date" type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input data-testid="leave-end-date" type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea data-testid="leave-reason-input" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Reason for leave" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApply(false)}>Cancel</Button>
            <Button data-testid="leave-submit-btn" onClick={handleApply} className="bg-blue-600 hover:bg-blue-700">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
