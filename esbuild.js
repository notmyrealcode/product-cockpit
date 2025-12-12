const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Build Tailwind CSS
function buildTailwind() {
  execSync('npx postcss ./src/webview/index.css -o ./out/webview/index.css', {
    stdio: 'inherit',
  });
}

// Build React webview
async function buildWebview() {
  const ctx = await esbuild.context({
    entryPoints: ['src/webview/index.tsx'],
    bundle: true,
    outfile: 'out/webview/webview.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: production,
    sourcemap: !production,
    define: {
      'process.env.NODE_ENV': production ? '"production"' : '"development"',
    },
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching webview...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

async function main() {
  fs.mkdirSync('out/webview', { recursive: true });
  buildTailwind();
  await buildWebview();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
