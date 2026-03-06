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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, Search, Building2, MoreHorizontal, Phone, Mail } from 'lucide-react';
import api from '@/lib/api';

export default function ClientsPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', pan_number: '', gst_number: '', services: [], notes: '' });
  const [serviceInput, setServiceInput] = useState('');

  const fetchClients = useCallback(async () => {
    try {
      const { data } = await api.get('/clients');
      setClients(data);
    } catch { toast.error('Failed to load clients'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const resetForm = () => {
    setForm({ name: '', email: '', phone: '', company: '', pan_number: '', gst_number: '', services: [], notes: '' });
    setServiceInput('');
    setEditClient(null);
  };

  const openEdit = (client) => {
    setEditClient(client);
    setForm({ name: client.name, email: client.email, phone: client.phone, company: client.company, pan_number: client.pan_number, gst_number: client.gst_number, services: client.services || [], notes: client.notes || '' });
    setShowCreate(true);
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Client name is required'); return; }
    try {
      if (editClient) {
        await api.put(`/clients/${editClient.id}`, form);
        toast.success('Client updated');
      } else {
        await api.post('/clients', form);
        toast.success('Client created');
      }
      setShowCreate(false);
      resetForm();
      fetchClients();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save client'); }
  };

  const deleteClient = async (id) => {
    try {
      await api.delete(`/clients/${id}`);
      toast.success('Client deleted');
      fetchClients();
    } catch (err) { toast.error('Failed to delete client'); }
  };

  const addService = () => {
    if (serviceInput.trim()) {
      setForm({ ...form, services: [...form.services, serviceInput.trim()] });
      setServiceInput('');
    }
  };

  const removeService = (idx) => {
    setForm({ ...form, services: form.services.filter((_, i) => i !== idx) });
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company?.toLowerCase().includes(search.toLowerCase()) ||
    c.pan_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div data-testid="clients-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage client information and services</p>
        </div>
        {isManager && (
          <Button data-testid="create-client-btn" onClick={() => { resetForm(); setShowCreate(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus size={16} className="mr-2" /> Add Client
          </Button>
        )}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input data-testid="client-search" placeholder="Search by name, company, or PAN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No clients found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-medium">Client</TableHead>
                  <TableHead className="font-medium">Company</TableHead>
                  <TableHead className="font-medium">Contact</TableHead>
                  <TableHead className="font-medium">PAN</TableHead>
                  <TableHead className="font-medium">GST</TableHead>
                  <TableHead className="font-medium">Services</TableHead>
                  {isManager && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.company || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {c.email && <span className="flex items-center gap-1"><Mail size={10} />{c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{c.pan_number || '-'}</TableCell>
                    <TableCell className="tabular-nums text-sm">{c.gst_number || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(c.services || []).slice(0, 2).map((s, i) => (
                          <Badge key={i} variant="secondary" className="bg-blue-50 text-blue-700 border-0 text-xs">{s}</Badge>
                        ))}
                        {(c.services || []).length > 2 && (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 text-xs">+{c.services.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button data-testid={`client-actions-${c.id}`} variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(c)}>Edit</DropdownMenuItem>
                            {user?.role === 'admin' && <DropdownMenuItem className="text-red-600" onClick={() => deleteClient(c.id)}>Delete</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Client Dialog */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{editClient ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input data-testid="client-name-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Client name" />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input data-testid="client-company-input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Company name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input data-testid="client-email-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input data-testid="client-phone-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input data-testid="client-pan-input" value={form.pan_number} onChange={e => setForm({...form, pan_number: e.target.value})} placeholder="ABCDE1234F" />
              </div>
              <div className="space-y-2">
                <Label>GST Number</Label>
                <Input data-testid="client-gst-input" value={form.gst_number} onChange={e => setForm({...form, gst_number: e.target.value})} placeholder="GST number" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Services</Label>
              <div className="flex gap-2">
                <Input value={serviceInput} onChange={e => setServiceInput(e.target.value)} placeholder="Add service (e.g. ITR Filing)" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addService())} />
                <Button type="button" variant="outline" onClick={addService}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {form.services.map((s, i) => (
                  <Badge key={i} variant="secondary" className="bg-blue-50 text-blue-700 border-0 cursor-pointer hover:bg-red-50 hover:text-red-700" onClick={() => removeService(i)}>
                    {s} x
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea data-testid="client-notes-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Additional notes" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button data-testid="client-submit-btn" onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
              {editClient ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
