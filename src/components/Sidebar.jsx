import React from 'react';
    import { Link, useLocation, useNavigate } from 'react-router-dom';
    import { Home, Settings, Users, TestTube as TestTubeDiagonal, Package, ClipboardList, ShieldCheck, DollarSign, Target, FlaskConical, X, ChevronsLeft, ChevronsRight, HelpCircle } from 'lucide-react';
    import { cn } from '@/lib/utils';
    import { Button } from '@/components/ui/button';
    import { motion, AnimatePresence } from 'framer-motion';
    import { useSidebar } from '@/contexts/SidebarContext';
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
    import { useToast } from './ui/use-toast';

    const navItems = [
      { href: '/', label: 'Inicio', icon: Home },
      { href: '/patients', label: 'Pacientes', icon: Users },
      { href: '/referrers', label: 'Referentes', icon: Users },
      { href: '/studies', label: 'Estudios', icon: TestTubeDiagonal },
      { href: '/packages', label: 'Paquetes', icon: Package },
      { href: '/orders', label: 'Órdenes', icon: ClipboardList },
      { href: '/administration', label: 'Administración', icon: ShieldCheck },
      { href: '/finance', label: 'Finanzas', icon: DollarSign },
      { href: '/marketing', label: 'Marketing', icon: Target },
      { href: '/settings', label: 'Configuración', icon: Settings },
    // ...existing code...
    ];

    const SidebarContent = () => {
      const location = useLocation();
      const navigate = useNavigate();
      const { isCollapsed, toggleSidebar, setSidebarOpen } = useSidebar();
      const { toast } = useToast();

      const handleLinkClick = () => {
        if (window.innerWidth < 1024) {
          setSidebarOpen(false);
        }
      };

      const handlePreviewManual = () => {
        toast({
          title: "Generando Manual",
          description: "Abriendo la previsualización del manual de usuario...",
        });
        navigate('/manual-preview');
        handleLinkClick();
      };

      return (
        <div className="flex flex-col h-full">
          <div className={cn("flex items-center justify-between p-2 mb-4", isCollapsed && "justify-center")}>
            <div className={cn("flex items-center space-x-2", isCollapsed && "justify-center")}>
              <FlaskConical className="h-8 w-8 text-sky-500 flex-shrink-0" />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl font-bold text-slate-800 dark:text-slate-100 origin-left"
                  >
                    LabG40
                  </motion.h1>
                )}
              </AnimatePresence>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6"/>
            </Button>
          </div>
          <nav className="flex-grow">
            <TooltipProvider delayDuration={0}>
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.href}
                          onClick={handleLinkClick}
                          className={cn(
                            "flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-150 ease-in-out",
                            "hover:bg-sky-100 dark:hover:bg-sky-700/30 hover:text-sky-600 dark:hover:text-sky-300",
                            location.pathname.startsWith(item.href) && item.href !== '/' || location.pathname === item.href
                              ? "bg-sky-500/10 text-sky-600 dark:bg-sky-600/20 dark:text-sky-200 font-semibold"
                              : "text-slate-600 dark:text-slate-300",
                            isCollapsed && "justify-center"
                          )}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <AnimatePresence>
                            {!isCollapsed && (
                              <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden whitespace-nowrap"
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </Link>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          <p>{item.label}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </TooltipProvider>
          </nav>
          <div className="mt-auto p-2 flex flex-col items-center">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" onClick={handlePreviewManual} className="w-full flex items-center justify-center mb-2">
                    <HelpCircle className="h-5 w-5 flex-shrink-0" />
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden whitespace-nowrap ml-3"
                        >
                          Manual de Usuario
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    <p>Ver Manual de Usuario</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-center text-xs text-slate-500 dark:text-slate-400 mb-4"
                >
                  <p>&copy; {new Date().getFullYear()} LabG40</p>
                  <p>Creado por Gonzalo Ibarra M.</p>
                </motion.div>
              )}
            </AnimatePresence>
            <Button variant="outline" onClick={toggleSidebar} className="w-10 h-10 lg:flex justify-center p-0">
              {isCollapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      );
    };

    const Sidebar = () => {
      const { isCollapsed, isSidebarOpen, setSidebarOpen } = useSidebar();

      const sidebarVariants = {
        open: { x: 0 },
        closed: { x: '-100%' },
      };

      return (
        <>
          {/* Mobile Sidebar */}
          <AnimatePresence>
            {isSidebarOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
                <motion.aside
                  variants={sidebarVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  className="fixed top-0 left-0 h-full w-64 bg-slate-50 dark:bg-slate-900 p-4 space-y-4 border-r border-slate-200 dark:border-slate-700 z-50 flex flex-col"
                >
                  <SidebarContent />
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Desktop Sidebar */}
          <motion.aside
            animate={{ width: isCollapsed ? '5rem' : '16rem' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="hidden lg:fixed lg:top-0 lg:left-0 lg:h-full lg:flex flex-col bg-slate-50 dark:bg-slate-900 p-4 space-y-4 border-r border-slate-200 dark:border-slate-700 z-30"
          >
            <SidebarContent />
          </motion.aside>
        </>
      );
    };

  export default Sidebar;