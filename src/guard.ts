// Last line of defence for a product page: an uncaught error mid-round would otherwise leave a
// silent, dead page. Say so, offer a reload, and keep the error in the log for the export.
import { h } from './lab/kit.ts';
import { Log } from './log.ts';

let shown = false;
function report(kind: string, err: unknown) {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  try { new Log().push('error', { kind, message, stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined, page: location.pathname }); } catch { /* the log itself may be what broke */ }
  if (shown) return;
  shown = true;
  document.body.append(h('div.toast.update.error', {}, 'Something broke on this page. ', h('button', { onclick: () => location.reload() }, 'Reload')));
}
window.addEventListener('error', (e) => report('error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => report('unhandledrejection', e.reason));
