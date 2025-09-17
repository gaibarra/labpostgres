import React, { createContext, useContext, useState, useEffect } from 'react';

    const SidebarContext = createContext();

    export const useSidebar = () => {
        const context = useContext(SidebarContext);
        if (!context) {
            throw new Error('useSidebar debe ser usado dentro de un SidebarProvider');
        }
        return context;
    };

    export const SidebarProvider = ({ children }) => {
        const [isCollapsed, setIsCollapsed] = useState(false);
        const [isSidebarOpen, setSidebarOpen] = useState(false);

        useEffect(() => {
            const checkSize = () => {
                if (window.innerWidth < 1024) {
                    setIsCollapsed(true);
                }
            };
            checkSize();
            window.addEventListener('resize', checkSize);
            return () => window.removeEventListener('resize', checkSize);
        }, []);

        const toggleSidebar = () => {
            // Solo permitir el colapso/expansión en pantallas grandes
            if (window.innerWidth >= 1024) {
                setIsCollapsed(prev => !prev);
            }
        };

        const toggleMobileSidebar = () => {
            setSidebarOpen(prev => !prev);
        };

        const value = {
            isCollapsed,
            toggleSidebar,
            isSidebarOpen,
            setSidebarOpen,
            toggleMobileSidebar
        };

        return (
            <SidebarContext.Provider value={value}>
                {children}
            </SidebarContext.Provider>
        );
    };