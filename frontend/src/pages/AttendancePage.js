import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, LogIn, LogOut, Calendar } from 'lucide-react';
import api from '@/lib/api';

export default function AttendancePage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [todayRecord, setTodayRecord] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchToday = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance/today');
      if (isManager) {
        setTodayRecord(Array.isArray(data) ? data : []);
      } else {
        setTodayRecord(data && data.id ? data : null);
      }
    } catch { /* silent */ }
  }, [isManager]);

  const fetchRecords = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance', { params: { date: selectedDate } });
      setRecords(data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [selectedDate]);

  useEffect(() => { fetchToday(); fetchRecords(); }, [fetchToday, fetchRecords]);

  const handleClockIn = async () => {
    setClockLoading(true);
    try {
      await api.post('/attendance/clock-in');
      toast.success('Clocked in successfully');
      fetchToday(); fetchRecords();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to clock in'); }
    finally { setClockLoading(false); }
  };

  const handleClockOut = async () => {
    setClockLoading(true);
    try {
      await api.post('/attendance/clock-out');
      toast.success('Clocked out successfully');
      fetchToday(); fetchRecords();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to clock out'); }
    finally { setClockLoading(false); }
  };

  const myToday = isManager ? null : todayRecord;
  const isClockedIn = myToday && myToday.clock_in && !myToday.clock_out;
  const isClockedOut = myToday && myToday.clock_out;
  const todayPresent = isManager && Array.isArray(todayRecord) ? todayRecord.length : 0;

  return (
    <div data-testid="attendance-page" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-1">Track daily presence and working hours</p>
      </div>

      {/* Today's Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Clock size={22} className="text-blue-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Status</p>
                <p className="text-lg font-semibold font-heading mt-0.5">
                  {!myToday || (!myToday.clock_in && !isManager) ? 'Not Clocked In' :
                   isClockedOut ? 'Day Complete' : isClockedIn ? 'Working' :
                   isManager ? `${todayPresent} Present` : 'Not Clocked In'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isManager && (
          <>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                    <LogIn size={22} className="text-green-600" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Clock In</p>
                    <p className="text-lg font-semibold font-heading mt-0.5 tabular-nums">
                      {myToday?.clock_in ? new Date(myToday.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                    <LogOut size={22} className="text-orange-600" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Clock Out</p>
                    <p className="text-lg font-semibold font-heading mt-0.5 tabular-nums">
                      {myToday?.clock_out ? new Date(myToday.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Clock In/Out Actions */}
      {!isManager && (
        <div className="flex gap-3">
          <Button
            data-testid="clock-in-btn"
            onClick={handleClockIn}
            disabled={clockLoading || isClockedIn || isClockedOut}
            className="bg-green-600 hover:bg-green-700"
          >
            <LogIn size={16} className="mr-2" /> Clock In
          </Button>
          <Button
            data-testid="clock-out-btn"
            onClick={handleClockOut}
            disabled={clockLoading || !isClockedIn || isClockedOut}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <LogOut size={16} className="mr-2" /> Clock Out
          </Button>
        </div>
      )}

      {/* Attendance History */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <Calendar size={18} className="text-blue-600" />
              Attendance Records
            </CardTitle>
            <input
              data-testid="attendance-date-filter"
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-9 px-3 rounded-md border border-slate-200 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No attendance records for this date</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  {isManager && <TableHead className="font-medium">Employee</TableHead>}
                  <TableHead className="font-medium">Date</TableHead>
                  <TableHead className="font-medium">Clock In</TableHead>
                  <TableHead className="font-medium">Clock Out</TableHead>
                  <TableHead className="font-medium">Hours</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => (
                  <TableRow key={r.id} className="hover:bg-slate-50/50">
                    {isManager && <TableCell className="font-medium">{r.user_name}</TableCell>}
                    <TableCell className="tabular-nums">{r.date}</TableCell>
                    <TableCell className="tabular-nums">
                      {r.clock_in ? new Date(r.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.clock_out ? new Date(r.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </TableCell>
                    <TableCell className="tabular-nums">{r.total_hours ? `${r.total_hours}h` : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`border-0 text-xs ${r.status === 'present' ? 'bg-green-100 text-green-800' : r.status === 'half_day' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {r.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
