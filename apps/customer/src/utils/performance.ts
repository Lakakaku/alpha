/**
 * Mobile Performance Optimization Utilities for Vocilia Customer Interface
 * 
 * Comprehensive performance optimization tools specifically designed for mobile devices.
 * Focuses on reducing load times, optimizing resource usage, and improving perceived performance.
 * 
 * Features:
 * - Image optimization and lazy loading
 * - Resource preloading and prefetching
 * - Performance monitoring and metrics
 * - Bundle optimization helpers
 * - Network-aware loading strategies
 * - Battery and memory optimization
 */

// === TYPES ===

interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  loadTime?: number;
  domContentLoaded?: number;
  interactive?: number;
  
  // Mobile-specific
  networkType?: string;
  batteryLevel?: number;
  memoryUsage?: number;
}

interface ImageOptimizationOptions {
  quality?: number;
  format?: 'webp' | 'avif' | 'auto';
  sizes?: string;
  lazy?: boolean;
  placeholder?: 'blur' | 'empty';
  priority?: boolean;
}

interface ResourceHint {
  href: string;
  as?: 'script' | 'style' | 'image' | 'font' | 'fetch';
  type?: string;
  crossorigin?: 'anonymous' | 'use-credentials';
}

interface NetworkInfo {
  effectiveType: '2g' | '3g' | '4g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

// === PERFORMANCE MONITORING ===

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];
  private startTime: number = performance.now();

  constructor() {
    this.initializeObservers();
    this.collectInitialMetrics();
  }

  private initializeObservers(): void {
    try {
      // Core Web Vitals
      const vitalsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          switch (entry.entryType) {
            case 'largest-contentful-paint':
              this.metrics.lcp = entry.startTime;
              break;
            case 'first-input':
              this.metrics.fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;
              break;
            case 'layout-shift':
              if (!(entry as any).hadRecentInput) {
                this.metrics.cls = (this.metrics.cls || 0) + (entry as any).value;
              }
              break;
          }
        }
      });

      vitalsObserver.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      this.observers.push(vitalsObserver);

      // Paint timing
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime;
          }
        }
      });

      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);

      // Navigation timing
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const navEntry = entry as PerformanceNavigationTiming;
          this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
          this.metrics.domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.fetchStart;
          this.metrics.loadTime = navEntry.loadEventEnd - navEntry.fetchStart;
          this.metrics.interactive = navEntry.domInteractive - navEntry.fetchStart;
        }
      });

      navObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navObserver);

    } catch (error) {
      console.warn('Performance monitoring not fully supported:', error);
    }
  }

  private collectInitialMetrics(): void {
    // Collect device and network info
    this.collectNetworkInfo();
    this.collectDeviceInfo();
  }

  private collectNetworkInfo(): void {
    try {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        this.metrics.networkType = connection.effectiveType;
      }
    } catch (error) {
      console.warn('Network information not available:', error);
    }
  }

  private collectDeviceInfo(): void {
    try {
      // Battery API
      (navigator as any).getBattery?.().then((battery: any) => {
        this.metrics.batteryLevel = battery.level;
      });

      // Memory API
      const memory = (performance as any).memory;
      if (memory) {
        this.metrics.memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;
      }
    } catch (error) {
      console.warn('Device information not available:', error);
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public reportMetrics(): void {
    const metrics = this.getMetrics();
    
    // Send to analytics (implement based on your analytics provider)
    console.log('Performance Metrics:', metrics);
    
    // Report to Web Vitals if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      Object.entries(metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          (window as any).gtag('event', key, {
            custom_parameter: value,
            event_category: 'performance',
          });
        }
      });
    }
  }

  public dispose(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// === IMAGE OPTIMIZATION ===

export class ImageOptimizer {
  private static instance: ImageOptimizer;
  private imageCache = new Map<string, string>();
  private loadingImages = new Set<string>();

  static getInstance(): ImageOptimizer {
    if (!ImageOptimizer.instance) {
      ImageOptimizer.instance = new ImageOptimizer();
    }
    return ImageOptimizer.instance;
  }

  /**
   * Optimizes image URLs for mobile devices
   */
  public optimizeImageUrl(
    src: string, 
    width: number, 
    height?: number, 
    options: ImageOptimizationOptions = {}
  ): string {
    const {
      quality = 85,
      format = 'auto',
      lazy = true
    } = options;

    // Check if we're using Next.js Image optimization
    if (src.startsWith('/_next/image')) {
      return src;
    }

    // Build optimization parameters
    const params = new URLSearchParams({
      w: width.toString(),
      q: quality.toString(),
      f: format,
    });

    if (height) {
      params.set('h', height.toString());
    }

    // Return optimized URL (adjust based on your image service)
    return `/api/images/optimize?url=${encodeURIComponent(src)}&${params.toString()}`;
  }

  /**
   * Lazy loads images with Intersection Observer
   */
  public lazyLoadImage(
    element: HTMLImageElement, 
    options: ImageOptimizationOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const { placeholder = 'empty' } = options;

      // Set placeholder
      if (placeholder === 'blur') {
        element.style.filter = 'blur(5px)';
        element.style.transition = 'filter 0.3s ease';
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const actualSrc = img.dataset.src;

            if (actualSrc && !this.loadingImages.has(actualSrc)) {
              this.loadingImages.add(actualSrc);
              
              const tempImg = new Image();
              tempImg.onload = () => {
                img.src = actualSrc;
                if (placeholder === 'blur') {
                  img.style.filter = 'none';
                }
                this.loadingImages.delete(actualSrc);
                observer.unobserve(img);
                resolve();
              };
              
              tempImg.onerror = () => {
                this.loadingImages.delete(actualSrc);
                observer.unobserve(img);
                reject(new Error(`Failed to load image: ${actualSrc}`));
              };
              
              tempImg.src = actualSrc;
            }
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '50px'
      });

      observer.observe(element);
    });
  }

  /**
   * Preloads critical images
   */
  public preloadImage(src: string, options: ImageOptimizationOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.imageCache.has(src)) {
        resolve();
        return;
      }

      const img = new Image();
      img.onload = () => {
        this.imageCache.set(src, src);
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to preload image: ${src}`));
      
      img.src = this.optimizeImageUrl(src, 800, undefined, options);
    });
  }
}

// === RESOURCE OPTIMIZATION ===

export class ResourceOptimizer {
  private preloadedResources = new Set<string>();

  /**
   * Adds resource hints to the document head
   */
  public addResourceHint(type: 'preload' | 'prefetch' | 'preconnect', hint: ResourceHint): void {
    if (typeof window === 'undefined') return;

    const key = `${type}-${hint.href}`;
    if (this.preloadedResources.has(key)) return;

    const link = document.createElement('link');
    link.rel = type;
    link.href = hint.href;
    
    if (hint.as) link.as = hint.as;
    if (hint.type) link.type = hint.type;
    if (hint.crossorigin) link.crossOrigin = hint.crossorigin;

    document.head.appendChild(link);
    this.preloadedResources.add(key);
  }

  /**
   * Preloads critical resources
   */
  public preloadCriticalResources(): void {
    const criticalResources: ResourceHint[] = [
      // Critical fonts
      { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2', crossorigin: 'anonymous' },
      
      // Critical images
      { href: '/images/logo.webp', as: 'image' },
      { href: '/images/hero-mobile.webp', as: 'image' },
      
      // API preconnects
      { href: process.env.NEXT_PUBLIC_API_URL || '', as: 'fetch' },
    ];

    criticalResources.forEach(resource => {
      if (resource.href) {
        this.addResourceHint('preload', resource);
      }
    });

    // Preconnect to external services
    this.addResourceHint('preconnect', { href: 'https://fonts.googleapis.com' });
    this.addResourceHint('preconnect', { href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' });
  }

  /**
   * Prefetches next probable pages
   */
  public prefetchNextPages(pages: string[]): void {
    if (!this.shouldPrefetch()) return;

    pages.forEach(page => {
      this.addResourceHint('prefetch', { href: page });
    });
  }

  private shouldPrefetch(): boolean {
    // Don't prefetch on slow connections or data saver mode
    const connection = this.getNetworkInfo();
    return !connection.saveData && !['slow-2g', '2g'].includes(connection.effectiveType);
  }

  private getNetworkInfo(): NetworkInfo {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    return {
      effectiveType: connection?.effectiveType || '4g',
      downlink: connection?.downlink || 10,
      rtt: connection?.rtt || 100,
      saveData: connection?.saveData || false,
    };
  }
}

// === BATTERY OPTIMIZATION ===

export class BatteryOptimizer {
  private batteryInfo: any = null;
  private isLowBattery = false;
  private optimizationLevel = 0; // 0-3 (none to aggressive)

  constructor() {
    this.initBatteryMonitoring();
  }

  private async initBatteryMonitoring(): Promise<void> {
    try {
      if ('getBattery' in navigator) {
        this.batteryInfo = await (navigator as any).getBattery();
        this.updateOptimizationLevel();

        // Listen for battery changes
        this.batteryInfo.addEventListener('levelchange', () => this.updateOptimizationLevel());
        this.batteryInfo.addEventListener('chargingchange', () => this.updateOptimizationLevel());
      }
    } catch (error) {
      console.warn('Battery API not available:', error);
    }
  }

  private updateOptimizationLevel(): void {
    if (!this.batteryInfo) return;

    const level = this.batteryInfo.level;
    const charging = this.batteryInfo.charging;

    if (charging) {
      this.optimizationLevel = 0; // No optimization when charging
    } else if (level > 0.5) {
      this.optimizationLevel = 1; // Light optimization
    } else if (level > 0.2) {
      this.optimizationLevel = 2; // Medium optimization
    } else {
      this.optimizationLevel = 3; // Aggressive optimization
    }

    this.isLowBattery = level < 0.2 && !charging;
  }

  public getOptimizationLevel(): number {
    return this.optimizationLevel;
  }

  public shouldReduceAnimations(): boolean {
    return this.optimizationLevel >= 2;
  }

  public shouldLimitBackgroundTasks(): boolean {
    return this.optimizationLevel >= 3;
  }

  public shouldReduceImageQuality(): boolean {
    return this.optimizationLevel >= 2;
  }

  public getRecommendedRefreshRate(): number {
    switch (this.optimizationLevel) {
      case 0: return 60; // Normal
      case 1: return 30; // Reduced
      case 2: return 15; // Low
      case 3: return 5;  // Minimal
      default: return 60;
    }
  }
}

// === BUNDLE OPTIMIZATION ===

export class BundleOptimizer {
  private loadedChunks = new Set<string>();

  /**
   * Dynamically imports modules based on user interaction
   */
  public async loadModule<T>(
    moduleLoader: () => Promise<T>,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<T> {
    // Implement priority-based loading
    if (priority === 'low' && !this.shouldLoadLowPriorityContent()) {
      // Defer loading for low priority content
      await this.waitForIdleTime();
    }

    try {
      return await moduleLoader();
    } catch (error) {
      console.error('Failed to load module:', error);
      throw error;
    }
  }

  /**
   * Waits for browser idle time before executing
   */
  private waitForIdleTime(): Promise<void> {
    return new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(resolve, { timeout: 5000 });
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  private shouldLoadLowPriorityContent(): boolean {
    const connection = (navigator as any).connection;
    if (!connection) return true;

    // Don't load low priority content on slow connections
    return !['slow-2g', '2g'].includes(connection.effectiveType) && !connection.saveData;
  }

  /**
   * Code splitting helper for React components
   */
  public createLazyComponent<T extends React.ComponentType<any>>(
    moduleLoader: () => Promise<{ default: T }>,
    fallback?: React.ComponentType
  ): React.LazyExoticComponent<T> {
    const LazyComponent = React.lazy(async () => {
      try {
        return await this.loadModule(moduleLoader, 'normal');
      } catch (error) {
        // Return fallback component on error
        if (fallback) {
          return { default: fallback as T };
        }
        throw error;
      }
    });

    return LazyComponent;
  }
}

// === PERFORMANCE UTILITIES ===

/**
 * Debounces function calls for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): T {
  let timeout: NodeJS.Timeout | null = null;

  return ((...args: any[]) => {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  }) as T;
}

/**
 * Throttles function calls for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;

  return ((...args: any[]) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}

/**
 * Optimizes scroll event listeners
 */
export function optimizeScrollListener(
  callback: (event: Event) => void,
  options: { passive?: boolean; throttle?: number } = {}
): () => void {
  const { passive = true, throttle: throttleMs = 16 } = options;
  
  const throttledCallback = throttleMs > 0 ? throttle(callback, throttleMs) : callback;
  
  const addEventListener = () => {
    window.addEventListener('scroll', throttledCallback, { passive });
  };
  
  const removeEventListener = () => {
    window.removeEventListener('scroll', throttledCallback);
  };
  
  addEventListener();
  return removeEventListener;
}

/**
 * Optimizes resize event listeners
 */
export function optimizeResizeListener(
  callback: (event: Event) => void,
  debounceMs = 250
): () => void {
  const debouncedCallback = debounce(callback, debounceMs);
  
  const addEventListener = () => {
    window.addEventListener('resize', debouncedCallback, { passive: true });
  };
  
  const removeEventListener = () => {
    window.removeEventListener('resize', debouncedCallback);
  };
  
  addEventListener();
  return removeEventListener;
}

// === SINGLETON INSTANCES ===

export const performanceMonitor = new PerformanceMonitor();
export const imageOptimizer = ImageOptimizer.getInstance();
export const resourceOptimizer = new ResourceOptimizer();
export const batteryOptimizer = new BatteryOptimizer();
export const bundleOptimizer = new BundleOptimizer();

// === INITIALIZATION ===

/**
 * Initializes all performance optimizations
 */
export function initializePerformanceOptimizations(): void {
  if (typeof window === 'undefined') return;

  // Preload critical resources
  resourceOptimizer.preloadCriticalResources();

  // Set up performance reporting
  window.addEventListener('beforeunload', () => {
    performanceMonitor.reportMetrics();
  });

  // Report metrics after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      performanceMonitor.reportMetrics();
    }, 1000);
  });

  console.log('🚀 Performance optimizations initialized');
}

// Auto-initialize on import
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initializePerformanceOptimizations);
}

// === EXPORTS ===

export type {
  PerformanceMetrics,
  ImageOptimizationOptions,
  ResourceHint,
  NetworkInfo,
};

// Import React for lazy component creation
import React from 'react';