import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Settings, Shield, Menu } from 'lucide-react';

const Header = ({ onMenuClick }) => {
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const labName = settings?.labInfo?.name?.trim() || 'LabG40';

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleMenuClick = () => {
    if (typeof onMenuClick === 'function') {
      onMenuClick();
    }
  };
  
  const getInitials = () => {
    if (user?.profile?.first_name && user?.profile?.last_name) {
      return `${user.profile.first_name[0]}${user.profile.last_name[0]}`;
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={handleMenuClick}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center text-center">
          <div className="flex w-full items-center justify-center gap-3">
            <BrandLogo
              showName={false}
              size="lg"
              className="hidden sm:flex"
              iconClassName="text-slate-600 dark:text-slate-200"
              imageClassName="h-12 w-auto max-w-[160px]"
            />
            <p className="text-sm sm:text-base md:text-lg font-semibold text-slate-800 dark:text-slate-100 text-center leading-tight break-words whitespace-normal">
              {labName}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-2 md:space-x-4">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.profile?.avatar_url || ''} alt="User Avatar" />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.profile?.first_name && user?.profile?.last_name ? `${user.profile.first_name} ${user.profile.last_name}` : 'Usuario'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {user?.email}
                  </p>
                  {user?.profile?.role && (
                    <div className="flex items-center pt-1">
                      <Shield className="mr-1.5 h-3 w-3 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">{user.profile.role}</p>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Perfil</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/administration/general-settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configuración</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;