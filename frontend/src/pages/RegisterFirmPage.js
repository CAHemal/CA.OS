import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, User, Mail, Lock, Phone, MapPin, FileText } from 'lucide-react';
import api from '@/lib/api';

export default function RegisterFirmPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firm_name: '',
    firm_phone: '',
    firm_address: '',
    firm_gstin: '',
    admin_name: '',
    admin_email: '',
    admin_password: '',
    admin_phone: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');

  const updateForm = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const validateStep1 = () => {
    if (!form.firm_name.trim()) {
      toast.error('Firm name is required');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.admin_name.trim()) {
      toast.error('Admin name is required');
      return false;
    }
    if (!form.admin_email.trim()) {
      toast.error('Email is required');
      return false;
    }
    if (!form.admin_password || form.admin_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return false;
    }
    if (form.admin_password !== confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const { data } = await api.post('/firms/register', form);
      // Auto-login after registration
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
        login(data.token, data.user);
        toast.success(`Welcome to CA.OS, ${data.user.name}! Your firm "${data.firm.name}" is ready.`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <span className="text-white font-bold text-lg">CA</span>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">CA.OS</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-6">
            Your CA Practice,<br />Digitized.
          </h1>
          <p className="text-indigo-200 text-lg leading-relaxed max-w-md">
            Manage tasks, track attendance, handle compliance deadlines, and run your entire CA firm from one platform.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-indigo-200">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <FileText size={16} className="text-white" />
            </div>
            <span>GST, ITR & TDS compliance tracking</span>
          </div>
          <div className="flex items-center gap-3 text-indigo-200">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <span>Employee & client management</span>
          </div>
          <div className="flex items-center gap-3 text-indigo-200">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Lock size={16} className="text-white" />
            </div>
            <span>Secure, isolated data per firm</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CA</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-zinc-900">CA.OS</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8">
            <h2 className="text-2xl font-bold text-zinc-900 mb-1">Register Your Firm</h2>
            <p className="text-zinc-500 text-sm mb-6">
              {step === 1 ? 'Step 1: Firm details' : 'Step 2: Admin account'}
            </p>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-zinc-200'}`} />
              <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-zinc-200'}`} />
            </div>

            {step === 1 ? (
              /* Step 1: Firm Details */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Firm Name *</Label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={form.firm_name}
                      onChange={e => updateForm('firm_name', e.target.value)}
                      placeholder="e.g. DDM & Associates"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Firm Phone</Label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={form.firm_phone}
                      onChange={e => updateForm('firm_phone', e.target.value)}
                      placeholder="+91 98765 43210"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Firm Address</Label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={form.firm_address}
                      onChange={e => updateForm('firm_address', e.target.value)}
                      placeholder="Office address"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>GSTIN (Optional)</Label>
                  <div className="relative">
                    <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={form.firm_gstin}
                      onChange={e => updateForm('firm_gstin', e.target.value)}
                      placeholder="22AAAAA0000A1Z5"
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => { if (validateStep1()) setStep(2); }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2"
                >
                  Continue →
                </Button>
              </div>
            ) : (
              /* Step 2: Admin Account */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Your Name *</Label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={form.admin_name}
                      onChange={e => updateForm('admin_name', e.target.value)}
                      placeholder="Full name"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email *</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      type="email"
                      value={form.admin_email}
                      onChange={e => updateForm('admin_email', e.target.value)}
                      placeholder="you@yourfirm.com"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={form.admin_phone}
                      onChange={e => updateForm('admin_phone', e.target.value)}
                      placeholder="+91 98765 43210"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      type="password"
                      value={form.admin_password}
                      onChange={e => updateForm('admin_password', e.target.value)}
                      placeholder="Min 6 characters"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirm Password *</Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    ← Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Creating...
                      </div>
                    ) : (
                      'Create Firm →'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-zinc-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
