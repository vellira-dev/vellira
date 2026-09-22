import { ToastProvider } from './Provider';
import { ToastRoot } from './Root';
import { ToastViewport } from './Viewport';

export const Toast = Object.assign(ToastRoot, {
  displayName: 'Toast',
  Provider: ToastProvider,
  Viewport: ToastViewport,
});
