import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site under /bricksy/; everything else assumes the root.
  base: process.env.GH_PAGES ? '/bricksy/' : '/',
  build: {
    rollupOptions: {
      input: { main: 'index.html', match: 'match.html', lab: 'lab.html', pack: 'pack/index.html', cut: 'cut/index.html', fold: 'fold/index.html', tilt: 'tilt/index.html', mirror: 'mirror/index.html', gears: 'gears/index.html', smuggle: 'smuggle/index.html', tightfit: 'tightfit/index.html', shadows: 'shadows/index.html', count: 'count/index.html', flash: 'flash/index.html' },
    },
  },
});
