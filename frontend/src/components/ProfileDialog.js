import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Phone, Building, Mail } from 'lucide-react';
import api from '@/lib/api';

export default function ProfileDialog({ open, onOpenChange }) {
  const { user, fetchUser } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', department: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        department: user.department || '',
      });
    }
  }, [open, user]);

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setLoading(true);
    try {
      await api.put('/auth/profile', form);
      toast.success('Profile updated successfully');
      await fetchUser();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-center">My Profile</DialogTitle>
          <DialogDescription className="text-center">Update your personal details and phone number</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-3">
          <Avatar className="h-16 w-16 ring-4 ring-indigo-100">
            <AvatarFallback className="bg-indigo-600 text-white text-xl font-semibold">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Mail size={14} className="text-zinc-400" /> Email</Label>
            <Input value={user?.email || ''} disabled className="bg-zinc-50 text-zinc-500" />
            <p className="text-[11px] text-zinc-400">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><User size={14} className="text-zinc-400" /> Full Name</Label>
            <Input
              data-testid="profile-name-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your full name"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Phone size={14} className="text-zinc-400" /> Phone Number</Label>
            <Input
              data-testid="profile-phone-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="e.g. 9876543210 or +919876543210"
              className="h-11"
            />
            <p className="text-[11px] text-zinc-400">Required for OTP-based password change. Numbers without country code default to +91 (India).</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Building size={14} className="text-zinc-400" /> Department</Label>
            <Input
              data-testid="profile-dept-input"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="e.g. Audit, Tax, Accounting"
              className="h-11"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            data-testid="profile-save-btn"
            onClick={handleSave}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
