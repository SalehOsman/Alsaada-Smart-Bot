import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { SidebarProvider } from './sidebar-context';
import { CommandPalette } from './command-palette';

interface DashboardShellProps {
  children: React.ReactNode;
}

export async function DashboardShell({ children }: DashboardShellProps) {
  const user = await getCurrentUser({ nullable: true });
  if (!user) {
    redirect('/session-expired');
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <Header user={user} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
