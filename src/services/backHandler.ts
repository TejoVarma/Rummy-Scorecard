import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const BACK_PRIORITY = {
  ROOT: 0,
  SCREEN: 10,
  GLOBAL_MODAL: 50,
  NESTED_MODAL: 100,
} as const;

export type BackPriority = typeof BACK_PRIORITY[keyof typeof BACK_PRIORITY] | number;

export interface BackHandlerRegistration {
  id: string;
  priority: number;
  handler: () => boolean | void;
}

export class BackButtonManager {
  private handlers: BackHandlerRegistration[] = [];
  private lastBackPressTime = 0;
  private isInitialized = false;
  private exitToastListeners = new Set<(visible: boolean) => void>();
  private exitToastTimer: ReturnType<typeof setTimeout> | null = null;

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Capacitor native Android back button & gesture listener
    if (typeof window !== 'undefined') {
      try {
        CapApp.addListener('backButton', () => {
          this.handleBack();
        }).catch(err => {
          console.warn('Capacitor App backButton listener registration error:', err);
        });
      } catch (err) {
        console.warn('Capacitor App backButton listener registration:', err);
      }

      // Keyboard Escape key support for desktop browsers
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.handleBack();
        }
      });
    }
  }

  public register(
    id: string,
    handler: () => boolean | void,
    priority: number = BACK_PRIORITY.NESTED_MODAL
  ): () => void {
    this.init();

    this.handlers = this.handlers.filter(h => h.id !== id);
    this.handlers.push({ id, priority, handler });
    this.handlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.unregister(id);
    };
  }

  public unregister(id: string) {
    this.handlers = this.handlers.filter(h => h.id !== id);
  }

  public getActiveHandlers(): BackHandlerRegistration[] {
    return [...this.handlers];
  }

  public onExitToastChange(listener: (visible: boolean) => void): () => void {
    this.exitToastListeners.add(listener);
    return () => {
      this.exitToastListeners.delete(listener);
    };
  }

  public handleBack(): boolean {
    // Execute highest priority active handler
    for (const entry of this.handlers) {
      try {
        const result = entry.handler();
        if (result !== false) {
          return true;
        }
      } catch (err) {
        console.error(`Error in back handler ${entry.id}:`, err);
      }
    }

    // Root level handling (home screen without modals)
    const now = Date.now();
    if (now - this.lastBackPressTime < 2000) {
      if (Capacitor.isNativePlatform()) {
        CapApp.exitApp();
      }
      this.notifyToast(false);
      this.lastBackPressTime = 0;
      return true;
    } else {
      this.lastBackPressTime = now;
      this.triggerExitToast();
      return true;
    }
  }

  public resetLastBackPressTime() {
    this.lastBackPressTime = 0;
  }

  private triggerExitToast() {
    this.notifyToast(true);
    if (this.exitToastTimer) {
      clearTimeout(this.exitToastTimer);
    }
    this.exitToastTimer = setTimeout(() => {
      this.notifyToast(false);
      this.exitToastTimer = null;
    }, 2000);
  }

  private notifyToast(visible: boolean) {
    this.exitToastListeners.forEach(fn => {
      try {
        fn(visible);
      } catch (err) {
        console.error(err);
      }
    });
  }
}

export const backButtonManager = new BackButtonManager();
