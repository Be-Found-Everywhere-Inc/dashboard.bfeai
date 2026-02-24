'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Skeleton } from '@bfeai/ui';
import { User, Mail, Building2, Calendar, Search, CreditCard, ArrowRight, Settings } from 'lucide-react';

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Account Information</CardTitle>
            <CardDescription>Your personal details and preferences</CardDescription>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-2">
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
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-brand-indigo/30 to-brand-indigo/10 flex items-center justify-center border-4 border-brand-indigo/20 shadow-lg overflow-hidden">
                <User className="h-14 w-14 text-brand-indigo/70" />
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-foreground">{userData?.fullName}</h2>
              <p className="text-gray-700 dark:text-gray-300 flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                {userData?.email}
              </p>
            </div>
          </div>

          {/* Profile Details */}
          <div className="grid gap-4 pt-6 sm:grid-cols-2">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-background-secondary dark:bg-background-tertiary">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-indigo/10 text-brand-indigo">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Full Name</p>
                <p className="text-sm font-semibold text-foreground">{userData?.fullName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-background-secondary dark:bg-background-tertiary">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Company</p>
                <p className="text-sm font-semibold text-foreground">{userData?.company}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-background-secondary dark:bg-background-tertiary">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-light text-success">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Email</p>
                <p className="text-sm font-semibold text-foreground">{userData?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-background-secondary dark:bg-background-tertiary">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-light text-warning">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Member Since</p>
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

      {/* Your Apps Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Your Apps</CardTitle>
          <CardDescription>Access all BFEAI apps with your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Keywords Tool */}
            <a
              href="https://keywords.bfeai.com"
              className="group flex items-center gap-4 p-4 rounded-lg border border-border hover:border-brand-indigo hover:shadow-md transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-indigo/10 text-brand-indigo group-hover:bg-brand-indigo group-hover:text-white transition-colors">
                <Search className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground group-hover:text-brand-indigo transition-colors">
                  Keywords Tool
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">SEO keyword research and analysis</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-700 dark:text-gray-300 group-hover:text-brand-indigo group-hover:translate-x-1 transition-all" />
            </a>

            {/* Manage Subscriptions */}
            <a
              href="/billing"
              className="group flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary hover:shadow-md transition-all"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-light text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <CreditCard className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  Manage Subscriptions
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">View and manage your billing</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-700 dark:text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Quick Actions</CardTitle>
          <CardDescription>Common account management tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/settings">
              <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                <Settings className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-medium">Edit Profile</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Update your details</p>
                </div>
              </Button>
            </Link>
            <Link href="/settings/password">
              <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <div className="text-left">
                  <p className="font-medium">Change Password</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Update security</p>
                </div>
              </Button>
            </Link>
            <Link href="/billing">
              <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                <CreditCard className="h-4 w-4" />
                <div className="text-left">
                  <p className="font-medium">Billing</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">Payment methods</p>
                </div>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
