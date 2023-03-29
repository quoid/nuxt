import { createUnplugin } from 'unplugin'
import type { NuxtConfigLayer } from 'nuxt/schema'
import { resolveAlias } from '@nuxt/kit'
import MagicString from 'magic-string'

interface LayerAliasingOptions {
  sourcemap?: boolean
  transform?: boolean
  layers: NuxtConfigLayer[]
}

const ALIAS_RE = /(?<=['"])[~@]{1,2}(?=\/)/g

export const LayerAliasingPlugin = createUnplugin((options: LayerAliasingOptions) => {
  const aliases = Object.fromEntries(options.layers.map(l => [l.config.srcDir || l.cwd, {
    '~': l.config.srcDir || l.cwd,
    '@': l.config.srcDir || l.cwd,
    '~~': l.config.rootDir || l.cwd,
    '@@': l.config.rootDir || l.cwd
  }]))
  const layers = Object.keys(aliases)

  return {
    name: 'nuxt:layer-aliasing',
    enforce: 'pre',
    vite: {
      resolveId: {
        order: 'pre',
        async handler (id, importer) {
          if (!importer) { return }

          const layer = layers.find(l => importer.startsWith(l))
          if (!layer) { return }

          const resolvedId = resolveAlias(id, aliases[layer])
          if (resolvedId !== id) {
            return await this.resolve(resolvedId, importer, { skipSelf: true })
          }
        }
      }
    },

    // webpack-only transform
    transformInclude: id => options.transform && layers.some(dir => id.startsWith(dir)),
    transform (code, id) {
      if (!options.transform) { return }

      const layer = layers.find(l => id.startsWith(l))
      if (!layer || !code.match(ALIAS_RE)) { return }

      const s = new MagicString(code)
      s.replace(ALIAS_RE, r => aliases[layer][r as '~'] || r)

      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap ? s.generateMap({ source: id, includeContent: true }) : undefined
        }
      }
    }
  }
})
