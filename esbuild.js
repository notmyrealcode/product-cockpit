const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Build Tailwind CSS using Tailwind CLI v4
function buildTailwind() {
  execSync('npx @tailwindcss/cli -i ./src/webview/index.css -o ./out/webview/webview.css', {
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
    // Don't bundle CSS - we handle it separately with Tailwind CLI
    external: ['*.css'],
    loader: {
      '.css': 'empty',
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
