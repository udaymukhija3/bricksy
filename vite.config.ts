import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site under /bricksy/; everything else assumes the root.
  base: process.env.GH_PAGES ? '/bricksy/' : '/',
  build: {
    rollupOptions: {
      input: { main: 'index.html', match: 'match.html', lab: 'lab.html' },
    },
  },
});
