'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';

import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox } from '@bfeai/ui';
import { Trash2, ArrowLeft, AlertTriangle } from 'lucide-react';

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required for account deletion'),
  confirmation: z.string(),
  understand: z.boolean(),
}).refine(data => data.confirmation === 'DELETE', {
  message: 'You must type DELETE to confirm',
  path: ['confirmation'],
}).refine(data => data.understand === true, {
  message: 'You must confirm you understand this action',
  path: ['understand'],
});

type DeleteAccountFormData = z.infer<typeof deleteAccountSchema>;

export default function DeleteAccountPageClient() {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeleteAccountFormData>({
    resolver: zodResolver(deleteAccountSchema),
  });

  const onSubmit = async (data: DeleteAccountFormData) => {
    setIsDeleting(true);

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: data.password,
          confirmation: data.confirmation,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to delete account');
        setIsDeleting(false);
        return;
      }

      toast.success('Account deleted successfully');

      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Account deletion error:', error);
      toast.error('An error occurred. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-foreground-secondary hover:text-brand-indigo transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <Card className="border-error/30 dark:border-error/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error-light text-error">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg text-error">Delete Account</CardTitle>
              <CardDescription>Permanently delete your account and all associated data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warning Message */}
          <div className="flex gap-4 p-4 rounded-lg bg-error-light border border-error/30">
            <AlertTriangle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-error">Warning: This action cannot be undone</h3>
              <div className="mt-2 text-sm text-foreground-secondary">
                <p>Deleting your account will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Permanently delete your profile and account data</li>
                  <li>Remove access to all BFEAI applications</li>
                  <li>Cancel any active subscriptions</li>
                  <li>Delete all your saved data and preferences</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Deletion Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Confirm Your Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                {...register('password')}
                disabled={isDeleting}
              />
              {errors.password && (
                <p className="text-sm text-error">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Type <span className="font-bold text-error">DELETE</span> to confirm
              </Label>
              <Input
                id="confirmation"
                type="text"
                placeholder="DELETE"
                {...register('confirmation')}
                disabled={isDeleting}
              />
              {errors.confirmation && (
                <p className="text-sm text-error">{errors.confirmation.message}</p>
              )}
            </div>

            <div className="flex items-start space-x-3 p-4 rounded-lg bg-background-secondary dark:bg-background-tertiary">
              <Checkbox
                id="understand"
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(checked === true)}
                disabled={isDeleting}
              />
              <label
                htmlFor="understand"
                className="text-sm leading-relaxed text-foreground-secondary peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I understand that this action is permanent and cannot be undone. All my data will be permanently deleted.
              </label>
            </div>
            {errors.understand && (
              <p className="text-sm text-error">{errors.understand.message}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isDeleting}
                onClick={() => router.push('/settings')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="flex-1"
                disabled={isDeleting || !understood}
              >
                {isDeleting ? 'Deleting Account...' : 'Delete My Account'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
