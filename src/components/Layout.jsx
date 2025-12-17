import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Toaster } from "@/components/ui/toaster";
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';

const Layout = () => {
  const { isCollapsed, setSidebarOpen } = useSidebar();

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950">
      <Sidebar />
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden min-w-0 transition-all duration-300 ease-in-out",
        "lg:ml-64",
        isCollapsed && "lg:ml-20"
      )}>
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 flex flex-col overflow-y-auto bg-slate-100 dark:bg-slate-950 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  );
};

export default Layout;