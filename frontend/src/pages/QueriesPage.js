import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Plus, MessageSquare, Send, XCircle } from 'lucide-react';
import api from '@/lib/api';

const statusColors = {
  open: 'bg-blue-100 text-blue-800',
  responded: 'bg-green-100 text-green-800',
  closed: 'bg-slate-100 text-slate-700',
};

export default function QueriesPage() {
  const { user } = useAuth();
  const [queries, setQueries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [form, setForm] = useState({ title: '', description: '', to_user_id: '' });

  const fetchQueries = useCallback(async () => {
    try {
      const { data } = await api.get('/queries');
      setQueries(data);
    } catch { toast.error('Failed to load queries'); }
    finally { setLoading(false); }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const { data } = await api.get('/employees');
      setEmployees(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchQueries(); fetchEmployees(); }, [fetchQueries, fetchEmployees]);

  const handleCreate = async () => {
    if (!form.title || !form.description) { toast.error('Title and description are required'); return; }
    try {
      await api.post('/queries', form);
      toast.success('Query submitted');
      setShowCreate(false);
      setForm({ title: '', description: '', to_user_id: '' });
      fetchQueries();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create query'); }
  };

  const handleRespond = async () => {
    if (!responseText.trim()) return;
    try {
      const { data } = await api.post(`/queries/${selectedQuery.id}/respond`, { message: responseText });
      setSelectedQuery(data);
      setResponseText('');
      fetchQueries();
      toast.success('Response sent');
    } catch (err) { toast.error('Failed to send response'); }
  };

  const handleClose = async (queryId) => {
    try {
      const { data } = await api.put(`/queries/${queryId}/close`);
      setSelectedQuery(data);
      fetchQueries();
      toast.success('Query closed');
    } catch { toast.error('Failed to close query'); }
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <div data-testid="queries-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight">Queries</h1>
          <p className="text-muted-foreground mt-1">Internal communication and query resolution</p>
        </div>
        <Button data-testid="create-query-btn" onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={16} className="mr-2" /> New Query
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Query List */}
        <Card className="lg:col-span-5 border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <MessageSquare size={18} className="text-blue-600" /> All Queries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
              ) : queries.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No queries yet</div>
              ) : (
                <div className="divide-y">
                  {queries.map(q => (
                    <div
                      key={q.id}
                      data-testid={`query-item-${q.id}`}
                      onClick={() => setSelectedQuery(q)}
                      className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${selectedQuery?.id === q.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{q.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">From: {q.from_user_name}{q.to_user_name ? ` → ${q.to_user_name}` : ''}</p>
                        </div>
                        <Badge variant="secondary" className={`${statusColors[q.status]} border-0 text-xs shrink-0`}>{q.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{q.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        {q.responses?.length > 0 && (
                          <span className="text-xs text-blue-600">{q.responses.length} response{q.responses.length > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Query Detail */}
        <Card className="lg:col-span-7 border-slate-200 shadow-sm">
          <CardContent className="p-0">
            {!selectedQuery ? (
              <div className="flex flex-col items-center justify-center h-[560px] text-muted-foreground">
                <MessageSquare size={40} strokeWidth={1} className="mb-3 opacity-30" />
                <p>Select a query to view details</p>
              </div>
            ) : (
              <div className="flex flex-col h-[560px]">
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold font-heading text-lg">{selectedQuery.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedQuery.from_user_name}{selectedQuery.to_user_name ? ` → ${selectedQuery.to_user_name}` : ''} ·{' '}
                        {new Date(selectedQuery.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={`${statusColors[selectedQuery.status]} border-0 text-xs`}>{selectedQuery.status}</Badge>
                      {selectedQuery.status !== 'closed' && (
                        <Button data-testid="close-query-btn" variant="ghost" size="sm" className="text-slate-500 hover:text-red-600" onClick={() => handleClose(selectedQuery.id)}>
                          <XCircle size={14} className="mr-1" /> Close
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm mt-3 leading-relaxed">{selectedQuery.description}</p>
                </div>
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-4">
                    {(selectedQuery.responses || []).map(r => (
                      <div key={r.id} className={`flex gap-3 ${r.user_id === user?.id ? 'flex-row-reverse' : ''}`}>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className={`text-xs ${r.user_id === user?.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                            {getInitials(r.user_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[80%] ${r.user_id === user?.id ? 'text-right' : ''}`}>
                          <div className={`rounded-lg p-3 text-sm ${r.user_id === user?.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                            {r.message}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {r.user_name} · {new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedQuery.status !== 'closed' && (
                  <div className="p-4 border-t border-slate-100">
                    <div className="flex gap-2">
                      <Input
                        data-testid="query-response-input"
                        value={responseText}
                        onChange={e => setResponseText(e.target.value)}
                        placeholder="Type your response..."
                        onKeyDown={e => e.key === 'Enter' && handleRespond()}
                      />
                      <Button data-testid="query-send-btn" onClick={handleRespond} className="bg-blue-600 hover:bg-blue-700">
                        <Send size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Query Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">New Query</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input data-testid="query-title-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Query subject" />
            </div>
            <div className="space-y-2">
              <Label>Directed To (Optional)</Label>
              <Select value={form.to_user_id} onValueChange={v => setForm({...form, to_user_id: v})}>
                <SelectTrigger data-testid="query-to-select"><SelectValue placeholder="Select recipient" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General (All)</SelectItem>
                  {employees.filter(e => e.id !== user?.id).map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea data-testid="query-desc-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe your query..." rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button data-testid="query-submit-btn" onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
