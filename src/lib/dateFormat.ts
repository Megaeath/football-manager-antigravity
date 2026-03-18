/**
 * Date Formatting Utility
 * 
 * Centralized date formatting with AD (Gregorian) calendar format
 * All dates in the application should use these utilities for consistency
 */

export type DateFormat = 'short' | 'medium' | 'long' | 'full' | 'iso' | 'relative';

export interface DateFormatOptions {
  format?: DateFormat;
  showTime?: boolean;
  showWeekday?: boolean;
}

/**
 * Format a date to AD (Gregorian) format
 * 
 * @param date - Date object or ISO string
 * @param options - Formatting options
 * @returns Formatted date string
 * 
 * @example
 * formatDate(new Date()) // "March 17, 2026"
 * formatDate(new Date(), { format: 'short' }) // "Mar 17, 2026"
 * formatDate(new Date(), { showTime: true }) // "March 17, 2026 at 2:30 PM"
 */
export function formatDate(date: Date | string | null | undefined, options?: DateFormatOptions): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  const { format = 'medium', showTime = false, showWeekday = false } = options || {};
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    day: 'numeric'
  };
  
  // Month format based on format type
  switch (format) {
    case 'short':
      formatOptions.month = 'short';
      break;
    case 'medium':
      formatOptions.month = 'long';
      break;
    case 'long':
      formatOptions.month = 'long';
      break;
    case 'full':
      formatOptions.month = 'long';
      formatOptions.weekday = 'long';
      break;
    case 'iso':
      return dateObj.toISOString().split('T')[0];
    case 'relative':
      return formatRelativeDate(dateObj);
  }
  
  // Add weekday if requested
  if (showWeekday) {
    formatOptions.weekday = 'short';
  }
  
  // Add time if requested
  if (showTime) {
    formatOptions.hour = 'numeric';
    formatOptions.minute = '2-digit';
  }
  
  return dateObj.toLocaleDateString('en-US', formatOptions);
}

/**
 * Format date to short format (MMM D, YYYY)
 * @example "Mar 17, 2026"
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  return formatDate(date, { format: 'short' });
}

/**
 * Format date to long format (MMMM D, YYYY)
 * @example "March 17, 2026"
 */
export function formatDateLong(date: Date | string | null | undefined): string {
  return formatDate(date, { format: 'long' });
}

/**
 * Format date to full format (Weekday, MMMM D, YYYY)
 * @example "Tuesday, March 17, 2026"
 */
export function formatDateFull(date: Date | string | null | undefined): string {
  return formatDate(date, { format: 'full' });
}

/**
 * Format date with time
 * @example "March 17, 2026 at 2:30 PM"
 */
export function formatDateWithTime(date: Date | string | null | undefined): string {
  return formatDate(date, { showTime: true });
}

/**
 * Format relative date (e.g., "2 days ago", "in 3 days")
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diffMs = dateObj.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays === 0) {
    if (diffHours === 0) {
      if (diffMinutes === 0) return 'Just now';
      if (diffMinutes > 0) return `In ${diffMinutes}m`;
      return `${Math.abs(diffMinutes)}m ago`;
    }
    if (diffHours > 0) return `In ${diffHours}h`;
    return `${Math.abs(diffHours)}h ago`;
  }
  
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  
  if (diffDays > 0) {
    if (diffDays < 7) return `In ${diffDays} days`;
    return formatDate(dateObj, { format: 'short' });
  }
  
  if (diffDays < 0) {
    if (diffDays > -7) return `${Math.abs(diffDays)} days ago`;
    return formatDate(dateObj, { format: 'short' });
  }
  
  return formatDate(dateObj, { format: 'short' });
}

/**
 * Format date to Thai month name but AD year (for transitional period)
 * @deprecated Use formatDate() instead - will be removed in next version
 */
export function formatDateThaiAD(date: Date | string | null | undefined): string {
  console.warn('formatDateThaiAD is deprecated. Use formatDate() instead.');
  return formatDate(date);
}

/**
 * Get date parts for custom formatting
 */
export function getDateParts(date: Date | string | null | undefined): {
  day: number;
  month: number;
  year: number;
  monthName: string;
  weekday: string;
} | null {
  if (!date) return null;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return null;
  
  return {
    day: dateObj.getDate(),
    month: dateObj.getMonth() + 1,
    year: dateObj.getFullYear(),
    monthName: dateObj.toLocaleDateString('en-US', { month: 'long' }),
    weekday: dateObj.toLocaleDateString('en-US', { weekday: 'long' })
  };
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  
  return dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear();
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.getTime() < new Date().getTime();
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.getTime() > new Date().getTime();
}

/**
 * Format duration (minutes) to human readable format
 * @example 90 -> "1h 30m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format match time (minute) to display format
 * @example 45 -> "45'"
 */
export function formatMatchTime(minute: number): string {
  return `${minute}'`;
}

export default formatDate;
