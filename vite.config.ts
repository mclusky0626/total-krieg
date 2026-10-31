import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `vite build --mode single` inlines the JS/CSS bundle into index.html so the
 * page can be hosted as one HTML file next to /data, /img and /portraits.
 */
function inlineBundle(): Plugin {
  return {
    name: 'inline-bundle',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const html = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName === 'index.html');
      if (!html || html.type !== 'asset') return;
      let src = String(html.source);
      for (const [name, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.isEntry) {
          src = src.replace(new RegExp(`<script type="module" crossorigin src="[^"]*${name}"></script>`),
            () => `<script type="module">${chunk.code.replace(/<\/script/g, '<\\/script')}</script>`);
          delete bundle[name];
        } else if (chunk.type === 'asset' && name.endsWith('.css')) {
          src = src.replace(new RegExp(`<link rel="stylesheet" crossorigin href="[^"]*${name}">`),
            () => `<style>${String(chunk.source)}</style>`);
          delete bundle[name];
        }
      }
      html.source = src;
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), mode === 'single' ? inlineBundle() : null],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    rollupOptions: mode === 'single' ? { output: { inlineDynamicImports: true } } : undefined,
  },
}));
