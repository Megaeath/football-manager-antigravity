'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';

interface AppShellProps {
    children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <>
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="w-full md:ml-[var(--sidebar-width)]">
                <div className="flex min-h-screen flex-col">
                    <Header onMenuClick={() => setIsSidebarOpen((prev) => !prev)} />
                    <Breadcrumbs />
                    <main className="flex-1 p-4 md:p-6">
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
}