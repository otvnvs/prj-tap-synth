
import { loadModule } from './lib/vue3-sfc-loader/vue3-sfc-loader.esm.js';
import * as Vue from './lib/vue/vue.esm-browser.prod.js';
import style from './style.css' with { type:'css'};
import { initDevTools } from './devtools.js'

// Execute immediately before Vue starts up
initDevTools()

// Expose these explicitly on window immediately so child scripts have access
window.Vue = Vue;
window.loadSfcModule = loadModule;

// service worker
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.sfc.js')
      .then(reg => console.log('Offline worker active!', reg.scope))
      .catch(err => console.error('Worker registration failed:', err));
  });
}


// styles
document.adoptedStyleSheets=[...document.adoptedStyleSheets,style]

const options = {
  moduleCache: { 
    vue: Vue
  },
  async getFile(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    return { getContentData: (asBinary) => asBinary ? res.arrayBuffer() : res.text() }
  },
  addStyle(styleStr) {
    const style = document.createElement('style');
    style.textContent = styleStr;
    document.head.appendChild(style);
  },
  pathResolve({ refPath, relPath }) {
    if (!refPath) return relPath;
    if (relPath.startsWith('.')) {
      return refPath.substring(0, refPath.lastIndexOf('/') + 1) + relPath;
    }
    return relPath;
  }
};

window.sfcLoaderOptions = options;

console.log(window.location);
loadModule('./src/Main.vue', options)
  .then(Main => Vue.createApp(Main).mount('#app'))
  .catch(err => console.error('App initialization failed:', err));

