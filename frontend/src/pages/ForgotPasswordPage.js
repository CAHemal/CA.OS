import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Phone, KeyRound, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=email, 2=otp, 3=new password
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password/send-otp', { email });
      setMaskedPhone(data.masked_phone);
      toast.success(data.message);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e) => {
    e.preventDefault();
    if (!code) { toast.error('Please enter the OTP code'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password/verify-reset', {
        email, code, new_password: newPassword
      });
      toast.success(data.message);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password/send-otp', { email });
      toast.success('OTP resent to ' + data.masked_phone);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50" data-testid="forgot-password-page">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg font-heading">CA</span>
        </div>
        <span className="text-2xl font-bold tracking-tight font-heading text-zinc-900">CA.OS</span>
      </div>

      <Card className="w-full max-w-md border-zinc-200 shadow-lg shadow-zinc-200/50">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
            {step === 1 && <Mail size={22} className="text-indigo-600" />}
            {step === 2 && <ShieldCheck size={22} className="text-indigo-600" />}
          </div>
          <CardTitle className="text-xl font-bold font-heading">
            {step === 1 ? 'Forgot Password' : 'Verify & Reset'}
          </CardTitle>
          <CardDescription>
            {step === 1
              ? 'Enter your email to receive an OTP on your registered phone number'
              : `OTP sent to ${maskedPhone}. Enter the code and set your new password.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input
                    id="email"
                    data-testid="forgot-email-input"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11"
                    required
                  />
                </div>
              </div>
              <Button data-testid="forgot-send-otp-btn" type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-semibold" disabled={loading}>
                {loading ? 'Sending OTP...' : (
                  <span className="flex items-center gap-2">Send OTP <ArrowRight size={16} /></span>
                )}
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1">
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyAndReset} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="otp">OTP Code</Label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <Input
                    id="otp"
                    data-testid="forgot-otp-input"
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="pl-9 h-11 text-center tracking-[0.3em] font-mono text-lg"
                    maxLength={6}
                    required
                  />
                </div>
                <button
                  type="button"
                  data-testid="resend-otp-btn"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Didn't receive? Resend OTP
                </button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  data-testid="forgot-new-password-input"
                  type="password"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  data-testid="forgot-confirm-password-input"
                  type="password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <Button data-testid="forgot-reset-btn" type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 font-semibold" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
              <div className="flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="text-sm text-zinc-500 hover:text-zinc-700 font-medium inline-flex items-center gap-1">
                  <ArrowLeft size={14} /> Change email
                </button>
                <Link to="/login" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
