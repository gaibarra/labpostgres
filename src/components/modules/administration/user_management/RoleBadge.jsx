import React from 'react';
import { useAppData } from '@/contexts/AppDataContext';

const RoleBadge = ({ role }) => {
  const { roles } = useAppData();
  const roleInfo = roles.find(r => r.role_name === role) || {};
  const label = roleInfo.label || role;
  const colorClass = roleInfo.color_class || 'bg-slate-100 text-slate-800 dark:bg-slate-600 dark:text-slate-200';

  return (
    <span className={`${colorClass} px-2 py-1 rounded-full text-xs font-semibold`}> {label} </span>
  );
};

export default RoleBadge;
