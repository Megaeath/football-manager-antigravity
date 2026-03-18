'use client';

import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient-primary' | 'gradient-success' | 'gradient-warning' | 'gradient-danger';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  hoverable?: boolean;
  style?: React.CSSProperties;
}

/**
 * Card Component - Consistent card container with variants
 * 
 * @example
 * // Basic card
 * <Card>Content here</Card>
 * 
 * @example
 * // Primary gradient card
 * <Card variant="gradient-primary">Important info</Card>
 * 
 * @example
 * // With custom padding
 * <Card padding="xl">Large content</Card>
 */
export function Card({ 
  children, 
  className = '', 
  variant = 'default',
  padding = 'lg',
  onClick,
  hoverable = false,
  style
}: CardProps) {
  const variantClasses = {
    'default': '',
    'gradient-primary': 'card-gradient-primary',
    'gradient-success': 'card-gradient-success',
    'gradient-warning': 'card-gradient-warning',
    'gradient-danger': 'card-gradient-danger'
  };

  const paddingClasses = {
    'sm': 'p-sm',
    'md': 'p-md',
    'lg': 'p-lg',
    'xl': 'p-xl'
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={`card ${variantClasses[variant]} ${paddingClasses[padding]} ${className} ${hoverable ? 'transition hover:shadow cursor-pointer' : ''}`}
      onClick={handleClick}
      style={style}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && handleClick() : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Card Header Component - Consistent card header styling
 */
export function CardHeader({ 
  children, 
  className = '',
  action 
}: { 
  children: React.ReactNode; 
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between mb-lg ${className}`}>
      {children}
      {action && <div>{action}</div>}
    </div>
  );
}

/**
 * Card Title Component - Consistent card title styling
 */
export function CardTitle({ 
  children, 
  className = '',
  level = 3
}: { 
  children: React.ReactNode; 
  className?: string;
  level?: 2 | 3 | 4;
}) {
  const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
  const sizeClasses = {
    2: 'text-2xl font-bold',
    3: 'text-xl font-semibold',
    4: 'text-lg font-semibold'
  };

  return (
    <Tag className={`${sizeClasses[level]} ${className}`} style={{ marginTop: 0, marginBottom: '0.5rem' }}>
      {children}
    </Tag>
  );
}

/**
 * Card Content Component - Consistent card content styling
 */
export function CardContent({ 
  children, 
  className = ''
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

/**
 * Card Footer Component - Consistent card footer styling
 */
export function CardFooter({ 
  children, 
  className = ''
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={`mt-lg pt-md border-t border-[var(--border)] ${className}`}>
      {children}
    </div>
  );
}

export default Card;
