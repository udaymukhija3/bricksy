// One link for "something's wrong / here's an idea": a GitHub issue pre-filled with the game, the
// daily number and the device, so a report from a phone needs nothing typed but the problem.
import { dayNumber } from './run.ts';

export const REPO = 'https://github.com/udaymukhija3/bricksy';

export function feedbackHref(game: string) {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const title = `${game}: `;
  const body = `Game: ${game}\nDaily: #${dayNumber()}\nDevice: ${ua}\n\nWhat happened / what you expected:\n`;
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

/** The footer link itself. */
export const feedbackLink = (game: string) => Object.assign(document.createElement('a'), { href: feedbackHref(game), textContent: 'feedback ↗', title: 'Report a bug or suggest something (opens a GitHub issue)', target: '_blank', rel: 'noopener' });
