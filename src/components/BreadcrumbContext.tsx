'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type BreadcrumbContextType = {
    names: Record<string, string>;
    setBreadcrumbName: (segment: string, name: string) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
    const [names, setNames] = useState<Record<string, string>>({});

    const setBreadcrumbName = (segment: string, name: string) => {
        setNames(prev => {
            if (prev[segment] === name) return prev;
            return { ...prev, [segment]: name };
        });
    };

    return (
        <BreadcrumbContext.Provider value={{ names, setBreadcrumbName }}>
            {children}
        </BreadcrumbContext.Provider>
    );
}

export function useBreadcrumb() {
    const context = useContext(BreadcrumbContext);
    if (!context) {
        throw new Error('useBreadcrumb must be used within a BreadcrumbProvider');
    }
    return context;
}

/**
 * Component to register a dynamic name for a breadcrumb segment
 */
export function BreadcrumbRegister({ segment, name }: { segment: string, name: string }) {
    const { setBreadcrumbName } = useBreadcrumb();

    useEffect(() => {
        setBreadcrumbName(segment, name);
    }, [segment, name, setBreadcrumbName]);

    return null;
}
