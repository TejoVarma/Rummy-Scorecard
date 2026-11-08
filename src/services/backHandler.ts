import { App as CapApp } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';

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
  seq: number;
  handler: () => boolean | void;
}

export class BackButtonManager {
  private handlers: BackHandlerRegistration[] = [];
  private lastBackPressTime = 0;
  private isInitialized = false;
  private seqCounter = 0;
  private exitToastListeners = new Set<(visible: boolean) => void>();
  private exitToastTimer: ReturnType<typeof setTimeout> | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private capListenerHandle: PluginListenerHandle | null = null;

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Capacitor native Android back button & gesture listener
    if (typeof window !== 'undefined') {
      try {
        CapApp.addListener('backButton', () => {
          this.handleBack();
        }).then(handle => {
          this.capListenerHandle = handle;
        }).catch(err => {
          console.warn('Capacitor App backButton listener registration error:', err);
        });
      } catch (err) {
        console.warn('Capacitor App backButton listener registration:', err);
      }

      // Keyboard Escape key support for desktop browsers
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.handleBack();
        }
      };
      window.addEventListener('keydown', this.keydownHandler);
    }
  }

  public register(
    id: string,
    handler: () => boolean | void,
    priority: number = BACK_PRIORITY.NESTED_MODAL
  ): () => void {
    this.init();

    this.handlers = this.handlers.filter(h => h.id !== id);
    this.seqCounter += 1;
    this.handlers.push({ id, priority, seq: this.seqCounter, handler });
    // Sort descending by priority, breaking ties with sequence descending (LIFO)
    this.handlers.sort((a, b) => b.priority - a.priority || b.seq - a.seq);

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
    // Execute highest priority active handler (LIFO on tie)
    for (const entry of this.handlers) {
      try {
        const result = entry.handler();
        if (result !== false) {
          // Handled successfully: reset exit guard & timer so root exit requires 2 fresh presses
          this.lastBackPressTime = 0;
          this.clearExitToastTimer();
          return true;
        }
      } catch (err) {
        console.error(`Error in back handler ${entry.id}; unregistering faulty handler:`, err);
        this.unregister(entry.id);
        // Continue loop to let next handler or root handle the back press
      }
    }

    // Root level handling (home screen without modals)
    const now = Date.now();
    if (now - this.lastBackPressTime < 2000) {
      if (Capacitor.isNativePlatform()) {
        CapApp.exitApp();
      }
      this.clearExitToastTimer();
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

  public clearExitToastTimer() {
    if (this.exitToastTimer) {
      clearTimeout(this.exitToastTimer);
      this.exitToastTimer = null;
    }
    this.notifyToast(false);
  }

  public destroy() {
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.capListenerHandle) {
      this.capListenerHandle.remove();
      this.capListenerHandle = null;
    }

    this.clearExitToastTimer();
    this.handlers = [];
    this.exitToastListeners.clear();
    this.lastBackPressTime = 0;
    this.isInitialized = false;
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
