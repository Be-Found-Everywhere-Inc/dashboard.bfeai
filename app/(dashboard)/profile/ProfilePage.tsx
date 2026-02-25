'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Skeleton } from '@bfeai/ui';
import { User, Mail, Building2, Calendar, Settings } from 'lucide-react';

interface UserData {
  fullName: string;
  email: string;
  company?: string;
  createdAt?: string;
  avatarUrl?: string;
}

export default function ProfilePageClient() {
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) return;

      const sessionData = await response.json();
      if (sessionData.authenticated && sessionData.user) {
        const profileResponse = await fetch('/api/profile');
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          setUserData({
            fullName: profileData.full_name || 'Not set',
            email: sessionData.user.email,
            company: profileData.company || 'Not set',
            createdAt: profileData.created_at,
            avatarUrl: profileData.avatar_url,
          });
        } else {
          setUserData({
            fullName: 'User',
            email: sessionData.user.email,
            company: 'Not set',
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="animate-fade-in-up">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-heading">Account Information</CardTitle>
            <CardDescription>Your personal details and preferences</CardDescription>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-2 btn-press">
              <Settings className="h-4 w-4" />
              Edit Profile
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {/* Profile Header */}
          <div className="flex items-center gap-6 pb-6 border-b border-border">
            {userData?.avatarUrl ? (
              <img
                src={userData.avatarUrl}
                alt={userData.fullName}
                className="h-24 w-24 rounded-full object-cover border-4 border-brand-indigo/20 shadow-lg"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-brand-indigo/30 to-brand-teal/20 flex items-center justify-center border-4 border-brand-indigo/20 shadow-lg overflow-hidden">
                <User className="h-14 w-14 text-brand-indigo/70" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-heading font-bold text-foreground">{userData?.fullName}</h2>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                {userData?.email}
              </p>
            </div>
          </div>

          {/* Profile Details */}
          <div className="grid gap-4 pt-6 sm:grid-cols-2">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-indigo/10 text-brand-indigo">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</p>
                <p className="text-sm font-semibold text-foreground">{userData?.fullName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</p>
                <p className="text-sm font-semibold text-foreground">{userData?.company}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="text-sm font-semibold text-foreground">{userData?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Member Since</p>
                <p className="text-sm font-semibold text-foreground">
                  {userData?.createdAt
                    ? new Date(userData.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
