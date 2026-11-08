import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackButtonManager, BACK_PRIORITY } from '../services/backHandler';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockReturnValue(Promise.resolve({ remove: vi.fn() })),
    exitApp: vi.fn().mockReturnValue(Promise.resolve()),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(true),
  },
}));

describe('BackButtonManager', () => {
  let manager: BackButtonManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    manager = new BackButtonManager();
  });

  it('executes highest priority handler first', () => {
    const order: string[] = [];

    manager.register('screen', () => {
      order.push('screen');
    }, BACK_PRIORITY.SCREEN);

    manager.register('modal', () => {
      order.push('modal');
    }, BACK_PRIORITY.GLOBAL_MODAL);

    manager.register('nested', () => {
      order.push('nested');
    }, BACK_PRIORITY.NESTED_MODAL);

    const handled = manager.handleBack();
    expect(handled).toBe(true);
    expect(order).toEqual(['nested']);
  });

  it('executes next handler when higher priority is unregistered', () => {
    const modalHandler = vi.fn();
    const screenHandler = vi.fn();

    const unregisterModal = manager.register('modal', modalHandler, BACK_PRIORITY.GLOBAL_MODAL);
    manager.register('screen', screenHandler, BACK_PRIORITY.SCREEN);

    unregisterModal();

    manager.handleBack();
    expect(modalHandler).not.toHaveBeenCalled();
    expect(screenHandler).toHaveBeenCalledTimes(1);
  });

  it('unregisters specific handler without affecting others at same priority', () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    const unregisterA = manager.register('a', handlerA, BACK_PRIORITY.GLOBAL_MODAL);
    manager.register('b', handlerB, BACK_PRIORITY.GLOBAL_MODAL);

    unregisterA();

    manager.handleBack();
    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledTimes(1);
  });

  it('falls through to lower priority handler if higher priority returns false', () => {
    const higherHandler = vi.fn().mockReturnValue(false);
    const lowerHandler = vi.fn().mockReturnValue(true);

    manager.register('higher', higherHandler, BACK_PRIORITY.GLOBAL_MODAL);
    manager.register('lower', lowerHandler, BACK_PRIORITY.SCREEN);

    manager.handleBack();
    expect(higherHandler).toHaveBeenCalledTimes(1);
    expect(lowerHandler).toHaveBeenCalledTimes(1);
  });

  it('triggers exit toast on first root back press and exits on second press within 2s', () => {
    const toastCallback = vi.fn();
    manager.onExitToastChange(toastCallback);

    // First back press at root
    const firstHandled = manager.handleBack();
    expect(firstHandled).toBe(true);
    expect(toastCallback).toHaveBeenCalledWith(true);
    expect(CapApp.exitApp).not.toHaveBeenCalled();

    // Second back press immediately
    const secondHandled = manager.handleBack();
    expect(secondHandled).toBe(true);
    expect(CapApp.exitApp).toHaveBeenCalledTimes(1);
    expect(toastCallback).toHaveBeenCalledWith(false);
  });

  it('resets exit timer if more than 2000ms elapse between root presses', () => {
    vi.useFakeTimers();
    const toastCallback = vi.fn();
    manager.onExitToastChange(toastCallback);

    manager.handleBack();
    expect(toastCallback).toHaveBeenCalledWith(true);
    expect(CapApp.exitApp).not.toHaveBeenCalled();

    // Advance time by 2100ms
    vi.advanceTimersByTime(2100);
    expect(toastCallback).toHaveBeenCalledWith(false);

    // Next back press should show toast again, not exit
    manager.handleBack();
    expect(CapApp.exitApp).not.toHaveBeenCalled();
    expect(toastCallback).toHaveBeenCalledWith(true);

    vi.useRealTimers();
  });
});
