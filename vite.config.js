import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// Single Vite project, four HTML entries:
//   /                          → arm demo (index.html)
//   /examples/gantry/          → gantry robot demo (examples/gantry/index.html)
//   /examples/warehouse/       → multi-robot stub (examples/warehouse/index.html)
//   /examples/site-planner/    → site layout tool (examples/site-planner/index.html)
//
// `npm run dev` starts ONE server that serves all four pages.  Vite
// auto-serves any .html file by path, so the rollupOptions.input below is
// only needed so production `npm run build` emits all four bundles.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/robo-playground/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      'robo-playground': path.resolve(here, 'src/lib/index.js'),
    },
  },
  optimizeDeps: { exclude: ['urdf-loader'] },
  assetsInclude: ['**/*.stl', '**/*.urdf'],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(here, 'index.html'),
        gantry: path.resolve(here, 'examples/gantry/index.html'),
        warehouse: path.resolve(here, 'examples/warehouse/index.html'),
        sitePlanner: path.resolve(here, 'examples/site-planner/index.html'),
      },
    },
  },
})
