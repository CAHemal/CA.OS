import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Plus, Search, Users, MoreHorizontal, Shield, UserCheck, UserX } from 'lucide-react';
import api from '@/lib/api';

const roleColors = {
  admin: 'bg-indigo-100 text-indigo-800',
  manager: 'bg-cyan-100 text-cyan-800',
  employee: 'bg-zinc-100 text-zinc-700',
};

export default function EmployeesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', department: '', phone: '' });

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await api.get('/employees');
      setEmployees(data);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      toast.error('Name, email, and password are required');
      return;
    }
    try {
      await api.post('/auth/register', form);
      toast.success('Employee created');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', role: 'employee', department: '', phone: '' });
      fetchEmployees();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create employee'); }
  };

  const updateRole = async (empId, role) => {
    try {
      await api.put(`/employees/${empId}`, { role });
      toast.success('Role updated');
      fetchEmployees();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update role'); }
  };

  const toggleActive = async (empId, currentStatus) => {
    try {
      await api.put(`/employees/${empId}`, { is_active: !currentStatus });
      toast.success(`Employee ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchEmployees();
    } catch (err) { toast.error('Failed to update status'); }
  };

  const deleteEmployee = async (empId) => {
    try {
      await api.delete(`/employees/${empId}`);
      toast.success('Employee deleted');
      fetchEmployees();
    } catch (err) { toast.error('Failed to delete employee'); }
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    e.department?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div data-testid="employees-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage staff members and roles</p>
        </div>
        <Button data-testid="create-employee-btn" onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus size={16} className="mr-2" /> Add Employee
        </Button>
      </div>

      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="employee-search" placeholder="Search by name, email, or department..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No employees found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50">
                  <TableHead className="font-medium">Employee</TableHead>
                  <TableHead className="font-medium">Email</TableHead>
                  <TableHead className="font-medium">Department</TableHead>
                  <TableHead className="font-medium">Role</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium">Joined</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(emp => (
                  <TableRow key={emp.id} className="hover:bg-zinc-50/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">{getInitials(emp.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{emp.name}</p>
                          {emp.phone && <p className="text-xs text-muted-foreground">{emp.phone}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                    <TableCell className="text-muted-foreground">{emp.department || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`${roleColors[emp.role]} border-0 text-xs capitalize`}>
                        <Shield size={10} className="mr-1" /> {emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`border-0 text-xs ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums text-sm">
                      {new Date(emp.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      {emp.id !== user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button data-testid={`emp-actions-${emp.id}`} variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isAdmin && emp.role !== 'admin' && <DropdownMenuItem onClick={() => updateRole(emp.id, 'admin')}>Make Admin</DropdownMenuItem>}
                            {isAdmin && emp.role !== 'manager' && <DropdownMenuItem onClick={() => updateRole(emp.id, 'manager')}>Make Manager</DropdownMenuItem>}
                            {emp.role !== 'employee' && <DropdownMenuItem onClick={() => updateRole(emp.id, 'employee')}>Make Employee</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => toggleActive(emp.id, emp.is_active)}>
                              {emp.is_active ? <><UserX size={14} className="mr-2" /> Deactivate</> : <><UserCheck size={14} className="mr-2" /> Activate</>}
                            </DropdownMenuItem>
                            {isAdmin && <DropdownMenuItem className="text-red-600" onClick={() => deleteEmployee(emp.id)}>Delete</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Employee Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add New Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input data-testid="emp-name-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Employee name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input data-testid="emp-email-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email address" />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input data-testid="emp-password-input" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Initial password" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                  <SelectTrigger data-testid="emp-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input data-testid="emp-dept-input" value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="Department" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input data-testid="emp-phone-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button data-testid="emp-submit-btn" onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700">Create Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
