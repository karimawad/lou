import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'

/**
 * Production Content-Security-Policy. Lou promises that tax data never leaves the
 * device; this makes the browser enforce it: no connections to any other origin.
 * - wasm-unsafe-eval: tesseract.js runs OCR in WebAssembly.
 * - worker-src blob: pdf.js and tesseract.js workers.
 * - style-src 'unsafe-inline': React inline style attributes.
 * Not applied in dev (Vite's HMR needs websockets and inline scripts).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: data:",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'lou-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
    },
  }
}

/**
 * Installable web app: after the build, writes dist/sw.js with the list of every built file (so the
 * service worker can keep all of Lou on the device for offline use) and a version hash of their contents
 * (so a new release is noticed). Source: sw/sw.js.
 */
function serviceWorker(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'lou-service-worker',
    apply: 'build',
    configResolved(c) { config = c },
    closeBundle() {
      const out = config.build.outDir
      const files: string[] = []
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const path = join(dir, name)
          if (statSync(path).isDirectory()) walk(path)
          else files.push(path)
        }
      }
      walk(out)
      const urls: string[] = []
      const hash = createHash('sha256')
      for (const path of files.sort()) {
        const url = '/' + relative(out, path).split(sep).join('/')
        // Host settings files (_headers, _redirects) aren't served to browsers.
        if (url === '/sw.js' || url.endsWith('.map') || /^\/_[a-z]+$/.test(url)) continue
        urls.push(url)
        hash.update(url).update(readFileSync(path))
      }
      const template = readFileSync('sw/sw.js', 'utf8')
      hash.update(template)
      const version = hash.digest('hex').slice(0, 12)
      const src = template
        .replace("const VERSION = '__VERSION__'", `const VERSION = '${version}'`)
        .replace('const PRECACHE = __PRECACHE__', `const PRECACHE = ${JSON.stringify(urls)}`)
      if (/__(PRECACHE|VERSION)__/.test(src)) throw new Error('sw/sw.js: a placeholder was not filled in')
      writeFileSync(join(out, 'sw.js'), src)
      config.logger.info(`service worker: ${urls.length} files, version ${version}`)
    },
  }
}

// https://vite.dev/config/
// Pages: the landing page at / (index.html), the tool at /app/, and two small pages for keys: /thanks/ and /recover/.
export default defineConfig({
  build: { rollupOptions: { input: { landing: resolve('index.html'), app: resolve('app/index.html'), thanks: resolve('thanks/index.html'), recover: resolve('recover/index.html') } } },
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version) },
  plugins: [react(), contentSecurityPolicy(), serviceWorker()],
})
