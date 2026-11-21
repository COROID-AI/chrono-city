import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { experiments } from './lab/catalogue.js';

const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value) => String(value).replace(/[&<>"']/g, (match) => entities[match]);

function renderEntry(entry) {
  const title = escape(entry.title);
  const page = escape(entry.page);
  const first = entry.years[0];
  const last = entry.years.at(-1);
  const prompt = entry.prompt
    ? `<blockquote>${escape(entry.prompt)}</blockquote>`
    : '<p>The verbatim prompt was unavailable in the implementation brief.</p>';
  return `
    <article class="entry">
      <figure class="plate">
        <img src="/${escape(entry.preview)}" alt="${escape(entry.previewAlt)}" width="1400" height="820">
        <figcaption><span>${title}</span><span>Scene capture · ${escape(entry.previewYear)}</span></figcaption>
      </figure>
      <div class="entry-copy">
        <p class="entry-meta">${escape(entry.subtitle)} <span aria-hidden="true">/</span> ${first}–${last}</p>
        <h3>${title}</h3>
        <p>${escape(entry.description)}</p>
        <a class="enter" href="./${page}">Enter the city <span aria-hidden="true">↗</span></a>
        <dl class="model-setup"><dt>Requested model setup</dt><dd>${entry.requestedModels.map(escape).join(' / ')}</dd></dl>
        <details>
          <summary>Experiment brief</summary>
          ${prompt}
        </details>
      </div>
    </article>`;
}

export default defineConfig({
  base: './',
  plugins: [{
    name: 'chronocity-catalogue',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('<!-- catalogue -->', () => experiments.map(renderEntry).join(''));
      },
    },
  }],
  build: {
    rollupOptions: {
      input: ['index.html', ...experiments.map((entry) => entry.page)].map((page) => resolve(page)),
      // The city is loaded independently of the gallery. The renderer is its largest dependency.
      output: { manualChunks: { three: ['three'] } },
    },
    chunkSizeWarningLimit: 600,
  },
});
