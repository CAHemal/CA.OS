import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 h-screen w-full" data-testid="login-page">
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-[#0F172A] text-white p-12 relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight font-heading">CA.OS</h1>
          <p className="text-slate-400 mt-1 text-sm">Staff Management System</p>
        </div>
        <div className="relative z-10 space-y-6">
          <blockquote className="text-2xl font-semibold leading-relaxed font-heading tracking-tight">
            Streamline your practice.<br />
            Manage your team with precision.
          </blockquote>
          <p className="text-slate-400 text-sm leading-relaxed max-w-md">
            Complete staff management for Chartered Accountant offices. Track tasks, attendance, leaves, clients, and more from one unified dashboard.
          </p>
        </div>
        <p className="text-slate-500 text-xs relative z-10">Chartered Accountant Office Suite</p>
        <div className="absolute inset-0 opacity-10">
          <img
            src="https://images.unsplash.com/photo-1756363211480-026e8b9b6482?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGdlb21ldHJpYyUyMHdoaXRlJTIwcGFwZXIlMjBhcmNoaXRlY3R1cmV8ZW58MHx8fHwxNzcyNzk3MTQ1fDA&ixlib=rb-4.1.0&q=85"
            alt="Abstract Architecture"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex items-center justify-center p-8 bg-[#F8FAFC]">
        <Card className="w-full max-w-md border-slate-200 shadow-sm">
          <CardHeader className="space-y-2 pb-6">
            <div className="lg:hidden mb-4">
              <h1 className="text-2xl font-extrabold tracking-tight font-heading">CA.OS</h1>
            </div>
            <CardTitle className="text-2xl font-bold font-heading">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    data-testid="login-email-input"
                    type="email"
                    placeholder="admin@caos.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    data-testid="login-password-input"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <Button data-testid="login-submit-btn" type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-4">
                Default credentials: admin@caos.com / admin123
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
