// Register the service worker in production builds only; in dev it would serve stale modules.
// The worker serves pages cache-first, so a new deploy is one visit behind: when it has fetched a
// newer page than the one on screen it says so, and the page offers a reload.
import { h } from './lab/kit.ts';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`); });
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type !== 'bricksy-update' || document.querySelector('.toast.update')) return;
    document.body.append(h('div.toast.update', {}, 'A newer version is ready. ', h('button', { onclick: () => location.reload() }, 'Reload')));
  });
}
