'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';

import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@bfeai/ui';
import { User, Building2, Briefcase, Camera, KeyRound, Trash2, Download } from 'lucide-react';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  company: z.string().max(100).optional(),
  industry: z.enum([
    'marketing_advertising',
    'ecommerce_retail',
    'saas_software',
    'agency',
    'healthcare',
    'finance',
    'education',
    'real_estate',
    'hospitality',
    'manufacturing',
    'professional_services',
    'nonprofit',
    'other',
  ]).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const industryOptions = [
  { value: 'marketing_advertising', label: 'Marketing & Advertising' },
  { value: 'ecommerce_retail', label: 'E-commerce & Retail' },
  { value: 'saas_software', label: 'SaaS & Software' },
  { value: 'agency', label: 'Agency' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'education', label: 'Education' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other' },
];

export default function SettingsPageClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [userData, setUserData] = useState<{
    email: string;
    fullName: string;
    company?: string;
    industry?: string;
    avatarUrl?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const selectedIndustry = watch('industry');

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) {
        router.push('/login');
        return;
      }

      const sessionData = await response.json();

      const profileResponse = await fetch('/api/profile');
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();

        const data = {
          email: sessionData.user.email,
          fullName: profileData.full_name || '',
          company: profileData.company || '',
          industry: profileData.industry || '',
          avatarUrl: profileData.avatar_url || '',
        };

        setUserData(data);
        setAvatarPreview(data.avatarUrl);

        setValue('fullName', data.fullName);
        setValue('company', data.company);
        if (data.industry) {
          setValue('industry', data.industry as any);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('File must be JPEG, PNG, WebP, or GIF');
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to upload avatar');
        return;
      }

      toast.success('Avatar uploaded successfully');
      setAvatarPreview(result.avatar_url);
      setUserData(prev => prev ? { ...prev, avatarUrl: result.avatar_url } : null);
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    if (!userData?.avatarUrl) return;

    setIsUploadingAvatar(true);

    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to remove avatar');
        return;
      }

      toast.success('Avatar removed successfully');
      setAvatarPreview(null);
      setUserData(prev => prev ? { ...prev, avatarUrl: undefined } : null);
    } catch (error) {
      console.error('Avatar removal error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: data.fullName,
          company: data.company || null,
          industry: data.industry || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to update profile');
        return;
      }

      toast.success('Profile updated successfully');

      setUserData({
        email: userData?.email || '',
        fullName: data.fullName,
        company: data.company,
        industry: data.industry,
        avatarUrl: userData?.avatarUrl,
      });
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/account/export');

      if (response.status === 429) {
        toast.error('You can only export your data once per hour. Please try again later.');
        return;
      }

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error || 'Failed to export data');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'bfeai-data-export.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Your data export has been downloaded');
    } catch (error) {
      console.error('Data export error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Avatar Upload */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-indigo/10 text-brand-indigo">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Profile Picture</CardTitle>
              <CardDescription>Upload a profile picture to personalize your account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="h-24 w-24 shrink-0 rounded-full object-cover border-4 border-border shadow-md"
              />
            ) : (
              <div className="h-24 w-24 shrink-0 rounded-full bg-background-secondary flex items-center justify-center border-4 border-border">
                <User className="h-12 w-12 text-gray-700 dark:text-gray-300" />
              </div>
            )}

            <div className="w-full space-y-3 text-center sm:w-auto sm:text-left">
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start sm:gap-3">
                <label htmlFor="avatar-upload">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploadingAvatar}
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    {isUploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  className="hidden"
                />

                {avatarPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={isUploadingAvatar}
                    onClick={handleAvatarRemove}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300">JPG, PNG, WebP or GIF. Max 5MB.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Profile Information</CardTitle>
              <CardDescription>Update your account details and preferences</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={userData?.email}
                disabled
                className="bg-background-secondary"
              />
              <p className="text-xs text-gray-700 dark:text-gray-300">
                Email cannot be changed. Contact support if you need assistance.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                {...register('fullName')}
                disabled={isSaving}
              />
              {errors.fullName && (
                <p className="text-sm text-error">{errors.fullName.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company (Optional)
                </Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Acme Inc."
                  {...register('company')}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Industry (Optional)
                </Label>
                <Select
                  value={selectedIndustry}
                  onValueChange={(value) => setValue('industry', value as any, { shouldDirty: true })}
                  disabled={isSaving}
                >
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select an industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industryOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-brand-indigo text-white hover:bg-brand-indigo/90"
              disabled={isSaving || !isDirty}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-light text-warning">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Security</CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/settings/password">
            <Button variant="outline" className="w-full gap-2">
              <KeyRound className="h-4 w-4" />
              Change Password
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Your Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Your Data</CardTitle>
              <CardDescription>Download a copy of all your personal data stored across BFEAI services</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-700 dark:text-gray-300">
            Includes your profile, settings, subscriptions, credits, keyword reports, bug reports, and activity history. Limited to 1 export per hour.
          </p>
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={isExporting}
            onClick={handleExportData}
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Preparing export...' : 'Download My Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-error/30 dark:border-error/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error-light text-error">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg text-error">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions that will permanently affect your account</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Link href="/settings/delete">
            <Button variant="destructive" className="w-full gap-2">
              <Trash2 className="h-4 w-4" />
              Delete Account
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
