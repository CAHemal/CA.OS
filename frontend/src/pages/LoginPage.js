import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from "react-router-dom";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Mail, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" data-testid="login-page">
      {/* Left: Branding (hidden on mobile, shown on desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-indigo-600 text-white p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <span className="text-white font-bold text-lg font-heading">CA</span>
            </div>
            <span className="text-2xl font-bold tracking-tight font-heading">CA.OS</span>
          </div>
          <p className="text-indigo-200 mt-1 text-sm">Staff Management System</p>
        </div>
        <div className="relative z-10 space-y-6">
          <blockquote className="text-3xl font-bold leading-tight font-heading tracking-tight">
            Streamline your practice.<br />
            Manage with clarity.
          </blockquote>
          <p className="text-indigo-200 text-base leading-relaxed max-w-md">
            Complete staff management for Chartered Accountant offices. Track tasks, attendance, leaves, clients, and more from one unified dashboard.
          </p>
          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-3xl font-bold font-heading">100%</p>
              <p className="text-indigo-200 text-sm">Paperless</p>
            </div>
            <div>
              <p className="text-3xl font-bold font-heading">3x</p>
              <p className="text-indigo-200 text-sm">Faster Tracking</p>
            </div>
            <div>
              <p className="text-3xl font-bold font-heading">24/7</p>
              <p className="text-indigo-200 text-sm">Access</p>
            </div>
          </div>
        </div>
        <p className="text-indigo-300 text-xs relative z-10">Chartered Accountant Office Suite</p>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-700 rounded-full translate-y-1/2 -translate-x-1/2 opacity-50" />
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 bg-zinc-50 min-h-screen lg:min-h-0">
        {/* Mobile brand header */}
        <div className="lg:hidden mb-8 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg font-heading">CA</span>
            </div>
            <span className="text-2xl font-bold tracking-tight font-heading text-zinc-900">CA.OS</span>
          </div>
          <p className="text-zinc-500 text-sm">Staff Management System</p>
        </div>

        <Card className="w-full max-w-md border-zinc-200 shadow-lg shadow-zinc-200/50">
          <CardHeader className="space-y-2 pb-6 text-center sm:text-left">
            <CardTitle className="text-2xl font-bold font-heading">Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input
                    id="email"
                    data-testid="login-email-input"
                    type="email"
                    placeholder="admin@caos.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input
                    id="password"
                    data-testid="login-password-input"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-11"
                    required
                  />
                </div>
              </div>
              <Button data-testid="login-submit-btn" type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-base font-semibold" disabled={loading}>
                {loading ? 'Signing in...' : (
                  <span className="flex items-center gap-2">Sign in <ArrowRight size={16} /></span>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-4">
                Default: admin@caos.com / admin123
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
