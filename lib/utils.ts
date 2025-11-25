import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback for SSR if window is undefined
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export function getAbsoluteUrl(path: string) {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
