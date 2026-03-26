import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Search, MoreHorizontal, Filter, FileText, IndianRupee, CreditCard, Trash2, Send, Eye } from 'lucide-react';
import api from '@/lib/api';

const statusColors = {
  draft: 'bg-zinc-100 text-zinc-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
};

const emptyItem = { description: '', hsn_sac: '', quantity: 1, rate: 0 };

export default function InvoicesPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showPayment, setShowPayment] = useState(null);
  const [showDetail, setShowDetail] = useState(null);

  const [form, setForm] = useState({
    client_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    items: [{ ...emptyItem }],
    gst_rate: 18,
    discount: 0,
    notes: '',
    payment_terms: 'Due on receipt',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'bank_transfer',
    reference_number: '',
    notes: '',
  });

  const fetchInvoices = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await api.get('/invoices', { params });
      setInvoices(data);
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  const fetchClients = useCallback(async () => {
    try {
      const { data } = await api.get('/clients');
      setClients(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Calculate totals
  const subtotal = form.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  const taxableAmount = subtotal - form.discount;
  const gstAmount = taxableAmount * form.gst_rate / 100;
  const total = taxableAmount + gstAmount;

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });
  const removeItem = (i) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  };
  const updateItem = (i, field, value) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: field === 'quantity' || field === 'rate' ? parseFloat(value) || 0 : value };
    setForm({ ...form, items });
  };

  const resetForm = () => {
    setForm({
      client_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      items: [{ ...emptyItem }],
      gst_rate: 18,
      discount: 0,
      notes: '',
      payment_terms: 'Due on receipt',
    });
  };

  const handleCreate = async () => {
    if (!form.client_id) { toast.error('Select a client'); return; }
    if (!form.due_date) { toast.error('Due date is required'); return; }
    if (!form.items.some(i => i.description && i.rate > 0)) { toast.error('Add at least one item'); return; }
    try {
      await api.post('/invoices', form);
      toast.success('Invoice created');
      setShowCreate(false);
      resetForm();
      fetchInvoices();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create invoice'); }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/invoices/${id}/status`, { status });
      toast.success(`Invoice ${status}`);
      fetchInvoices();
    } catch { toast.error('Failed to update'); }
  };

  const recordPayment = async () => {
    if (!paymentForm.amount || paymentForm.amount <= 0) { toast.error('Enter payment amount'); return; }
    try {
      await api.post(`/invoices/${showPayment.id}/payment`, paymentForm);
      toast.success('Payment recorded');
      setShowPayment(null);
      setPaymentForm({ amount: 0, payment_date: new Date().toISOString().split('T')[0], payment_mode: 'bank_transfer', reference_number: '', notes: '' });
      fetchInvoices();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to record payment'); }
  };

  const deleteInvoice = async (id) => {
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to delete'); }
  };

  const viewDetail = async (id) => {
    try {
      const { data } = await api.get(`/invoices/${id}`);
      setShowDetail(data);
    } catch { toast.error('Failed to load invoice'); }
  };

  const filtered = invoices.filter(i =>
    i.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    i.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount) => `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // Summary stats
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const totalPending = invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + i.balance_due, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1 text-sm">Create and manage billing invoices</p>
        </div>
        {isManager && (
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
            <Plus size={16} className="mr-2" /> New Invoice
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg"><FileText size={20} className="text-indigo-600" /></div>
            <div>
              <p className="text-2xl font-bold">{invoices.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg"><IndianRupee size={20} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Collected</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><CreditCard size={20} className="text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg"><FileText size={20} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold">{overdueCount}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter size={14} className="mr-2" /><SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>No invoices found</p>
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50/50">
                      <TableHead className="font-medium">Invoice #</TableHead>
                      <TableHead className="font-medium">Client</TableHead>
                      <TableHead className="font-medium">Date</TableHead>
                      <TableHead className="font-medium">Due</TableHead>
                      <TableHead className="font-medium text-right">Total</TableHead>
                      <TableHead className="font-medium text-right">Balance</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(inv => (
                      <TableRow key={inv.id} className="hover:bg-zinc-50/50 cursor-pointer" onClick={() => viewDetail(inv.id)}>
                        <TableCell className="font-medium font-mono text-sm">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.client_name}</TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(inv.total)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(inv.balance_due)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${statusColors[inv.status]} border-0 text-xs`}>{inv.status}</Badge>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {isManager && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => viewDetail(inv.id)}>
                                  <Eye size={14} className="mr-2" /> View
                                </DropdownMenuItem>
                                {inv.status === 'draft' && <DropdownMenuItem onClick={() => updateStatus(inv.id, 'sent')}>
                                  <Send size={14} className="mr-2" /> Mark as Sent
                                </DropdownMenuItem>}
                                {['sent', 'overdue'].includes(inv.status) && <DropdownMenuItem onClick={() => { setPaymentForm({ ...paymentForm, amount: inv.balance_due }); setShowPayment(inv); }}>
                                  <CreditCard size={14} className="mr-2" /> Record Payment
                                </DropdownMenuItem>}
                                {inv.status !== 'cancelled' && inv.status !== 'paid' && <DropdownMenuItem onClick={() => updateStatus(inv.id, 'cancelled')} className="text-red-600">Cancel</DropdownMenuItem>}
                                {['draft', 'cancelled'].includes(inv.status) && <DropdownMenuItem onClick={() => deleteInvoice(inv.id)} className="text-red-600">
                                  <Trash2 size={14} className="mr-2" /> Delete
                                </DropdownMenuItem>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile */}
              <div className="md:hidden divide-y divide-zinc-100">
                {filtered.map(inv => (
                  <div key={inv.id} className="p-4 space-y-2" onClick={() => viewDetail(inv.id)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-sm font-medium">{inv.invoice_number}</p>
                        <p className="text-sm text-muted-foreground">{inv.client_name}</p>
                      </div>
                      <Badge variant="secondary" className={`${statusColors[inv.status]} border-0 text-xs`}>{inv.status}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Due {new Date(inv.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                      <span className="font-medium">{formatCurrency(inv.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Items</Label>
                <Button variant="outline" size="sm" onClick={addItem} className="text-xs h-7">
                  <Plus size={12} className="mr-1" /> Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <Input placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} className="flex-1" />
                    <Input placeholder="HSN/SAC" value={item.hsn_sac} onChange={e => updateItem(i, 'hsn_sac', e.target.value)} className="w-24" />
                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="w-16" min="1" />
                    <Input type="number" placeholder="Rate" value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} className="w-24" min="0" />
                    <div className="w-24 text-right pt-2 text-sm font-medium tabular-nums">{formatCurrency(item.quantity * item.rate)}</div>
                    {form.items.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-red-500 shrink-0" onClick={() => removeItem(i)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span><span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center gap-2">
                <span>Discount</span>
                <Input type="number" value={form.discount} onChange={e => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} className="w-28 text-right" min="0" />
              </div>
              <div className="flex justify-between text-sm items-center gap-2">
                <span>GST Rate (%)</span>
                <Select value={String(form.gst_rate)} onValueChange={v => setForm({ ...form, gst_rate: parseFloat(v) })}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="12">12%</SelectItem>
                    <SelectItem value="18">18%</SelectItem>
                    <SelectItem value="28">28%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between text-sm">
                <span>CGST ({form.gst_rate / 2}%)</span><span className="tabular-nums">{formatCurrency(gstAmount / 2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>SGST ({form.gst_rate / 2}%)</span><span className="tabular-nums">{formatCurrency(gstAmount / 2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-zinc-200 pt-2 mt-2">
                <span>Total</span><span className="tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Additional notes..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700">Create Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={!!showPayment} onOpenChange={() => setShowPayment(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Record Payment</DialogTitle>
          </DialogHeader>
          {showPayment && (
            <div className="space-y-4 py-2">
              <div className="bg-zinc-50 rounded-lg p-3">
                <p className="font-mono text-sm">{showPayment.invoice_number}</p>
                <p className="text-sm text-muted-foreground">{showPayment.client_name}</p>
                <p className="text-lg font-bold mt-1">Balance: {formatCurrency(showPayment.balance_due)}</p>
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })} min="0" />
              </div>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={paymentForm.payment_mode} onValueChange={v => setPaymentForm({ ...paymentForm, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference / UTR Number</Label>
                <Input value={paymentForm.reference_number} onChange={e => setPaymentForm({ ...paymentForm, reference_number: e.target.value })} placeholder="Transaction reference" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(null)}>Cancel</Button>
            <Button onClick={recordPayment} className="bg-emerald-600 hover:bg-emerald-700">Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Invoice {showDetail?.invoice_number}</DialogTitle>
          </DialogHeader>
          {showDetail && (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{showDetail.client_name}</p>
                  {showDetail.client_company && <p className="text-sm text-muted-foreground">{showDetail.client_company}</p>}
                  {showDetail.client_gst && <p className="text-xs text-muted-foreground">GSTIN: {showDetail.client_gst}</p>}
                  {showDetail.client_pan && <p className="text-xs text-muted-foreground">PAN: {showDetail.client_pan}</p>}
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className={`${statusColors[showDetail.status]} border-0 mb-2`}>{showDetail.status}</Badge>
                  <p className="text-sm">Date: {new Date(showDetail.invoice_date).toLocaleDateString('en-IN')}</p>
                  <p className="text-sm">Due: {new Date(showDetail.due_date).toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              {/* Items */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>HSN/SAC</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {showDetail.items?.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-muted-foreground">{item.hsn_sac || '-'}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="bg-zinc-50 rounded-lg p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(showDetail.subtotal)}</span></div>
                {showDetail.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span className="tabular-nums">-{formatCurrency(showDetail.discount)}</span></div>}
                <div className="flex justify-between"><span>CGST ({showDetail.gst_rate / 2}%)</span><span className="tabular-nums">{formatCurrency(showDetail.cgst)}</span></div>
                <div className="flex justify-between"><span>SGST ({showDetail.gst_rate / 2}%)</span><span className="tabular-nums">{formatCurrency(showDetail.sgst)}</span></div>
                <div className="flex justify-between font-bold text-base border-t border-zinc-200 pt-2 mt-2"><span>Total</span><span className="tabular-nums">{formatCurrency(showDetail.total)}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Paid</span><span className="tabular-nums">{formatCurrency(showDetail.amount_paid)}</span></div>
                <div className="flex justify-between font-bold text-red-600"><span>Balance Due</span><span className="tabular-nums">{formatCurrency(showDetail.balance_due)}</span></div>
              </div>

              {/* Payment History */}
              {showDetail.payments?.length > 0 && (
                <div>
                  <p className="font-medium text-sm mb-2">Payment History</p>
                  <div className="space-y-2">
                    {showDetail.payments.map((p, i) => (
                      <div key={i} className="flex justify-between items-center text-sm bg-emerald-50 rounded-lg p-3">
                        <div>
                          <p className="font-medium">{formatCurrency(p.amount)} via {p.payment_mode.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{p.reference_number && `Ref: ${p.reference_number} • `}{new Date(p.payment_date).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showDetail.notes && (
                <div>
                  <p className="font-medium text-sm mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{showDetail.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
