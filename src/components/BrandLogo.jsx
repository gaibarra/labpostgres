import React from 'react';
import { FlaskConical } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSettings } from '@/contexts/SettingsContext';
import { cn } from '@/lib/utils';

const sizeMap = {
  sm: { icon: 'h-8 w-8', text: 'text-lg' },
  md: { icon: 'h-10 w-10', text: 'text-2xl' },
  lg: { icon: 'h-14 w-14', text: 'text-3xl' },
};

const getLogoUrl = (settings) => {
  const uiLogo = typeof settings?.uiSettings?.logoUrl === 'string' ? settings.uiSettings.logoUrl.trim() : '';
  const labLogo = typeof settings?.labInfo?.logoUrl === 'string' ? settings.labInfo.logoUrl.trim() : '';
  return uiLogo || labLogo || '';
};

const BrandLogo = ({
  showName = true,
  orientation = 'row',
  size = 'md',
  className,
  imageClassName,
  textClassName,
  iconClassName,
  shouldAnimateText = false,
}) => {
  const { settings } = useSettings();
  const logoUrl = getLogoUrl(settings);
  const labName = settings?.labInfo?.name?.trim() || 'LabG40';
  const sizeClasses = sizeMap[size] || sizeMap.md;

  const containerClasses = cn(
    'flex items-center gap-3',
    orientation === 'column' && 'flex-col gap-2 text-center',
    className
  );

  const textClasses = cn(
    'font-semibold tracking-tight text-slate-800 dark:text-slate-100',
    sizeClasses.text,
    textClassName
  );

  const iconClasses = cn('text-sky-500 flex-shrink-0', sizeClasses.icon, iconClassName);
  const imageClasses = cn('object-contain', sizeClasses.icon, imageClassName);

  const animatedText = (
    <motion.span
      key="brand-logo-text"
      initial={shouldAnimateText ? { opacity: 0, x: -20 } : false}
      animate={shouldAnimateText ? { opacity: 1, x: 0 } : {}}
      exit={shouldAnimateText ? { opacity: 0, x: -20 } : {}}
      transition={{ duration: 0.2 }}
      className={textClasses}
    >
      {labName}
    </motion.span>
  );

  return (
    <div className={containerClasses}>
      {logoUrl ? (
        <img src={logoUrl} alt={`Logo ${labName}`} className={imageClasses} loading="lazy" />
      ) : (
        <FlaskConical aria-hidden="true" className={iconClasses} />
      )}
      {shouldAnimateText ? (
        <AnimatePresence initial={false}>{showName && animatedText}</AnimatePresence>
      ) : (
        showName && <span className={textClasses}>{labName}</span>
      )}
    </div>
  );
};

export default BrandLogo;
