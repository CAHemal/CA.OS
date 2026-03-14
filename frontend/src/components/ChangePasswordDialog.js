import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck, Phone } from 'lucide-react';
import api from '@/lib/api';

export default function ChangePasswordDialog({ open, onOpenChange }) {
  const [step, setStep] = useState(1); // 1=send OTP, 2=verify+change
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep(1);
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setMaskedPhone('');
  };

  const handleClose = (v) => {
    onOpenChange(v);
    if (!v) reset();
  };

  const handleSendOTP = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password/send-otp');
      setMaskedPhone(data.masked_phone);
      toast.success(data.message);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!code) { toast.error('Please enter the OTP code'); return; }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password/verify', {
        code, new_password: newPassword
      });
      toast.success(data.message);
      handleClose(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password/send-otp');
      toast.success('OTP resent to ' + data.masked_phone);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to resend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-2">
            {step === 1 ? <Phone size={22} className="text-indigo-600" /> : <ShieldCheck size={22} className="text-indigo-600" />}
          </div>
          <DialogTitle className="font-heading text-center">
            {step === 1 ? 'Change Password' : 'Verify & Change'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === 1
              ? 'We\'ll send an OTP to your registered phone number for verification'
              : `OTP sent to ${maskedPhone}. Enter the code and set your new password.`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="py-4 flex justify-center">
            <Button
              data-testid="change-pw-send-otp-btn"
              onClick={handleSendOTP}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 h-11 px-8 font-semibold"
            >
              {loading ? 'Sending OTP...' : 'Send OTP to My Phone'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>OTP Code</Label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  data-testid="change-pw-otp-input"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="pl-9 h-11 text-center tracking-[0.3em] font-mono text-lg"
                  maxLength={6}
                />
              </div>
              <button
                type="button"
                data-testid="change-pw-resend-btn"
                onClick={handleResendOTP}
                disabled={loading}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Didn't receive? Resend OTP
              </button>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                data-testid="change-pw-new-input"
                type="password"
                placeholder="Min 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                data-testid="change-pw-confirm-input"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button
              data-testid="change-pw-submit-btn"
              onClick={handleChangePassword}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
