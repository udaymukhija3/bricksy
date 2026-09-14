// Entry for every standalone game page: the page names its game in <html data-game>.
import './style.css';
import './pwa';
import { GAMES } from './games';
import { renderFrame } from './lab/frame';

const id = document.documentElement.dataset.game;
const def = GAMES.find((g) => g.id === id);
if (!def) throw new Error(`unknown game ${id}`);
renderFrame(document.getElementById('app')!, def, '../', '← bricksy');
