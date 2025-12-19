const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

// Build Tailwind CSS using Tailwind CLI v4
function buildTailwind() {
  execSync('npx @tailwindcss/cli -i ./src/webview/index.css -o ./out/webview/webview.css', {
    stdio: 'inherit',
  });
}

// Build extension host (Node.js) code
async function buildExtension() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'out/extension.js',
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    minify: production,
    sourcemap: !production,
    external: ['vscode'],  // VS Code API is provided at runtime
    loader: {
      '.wasm': 'file',  // sql.js uses WASM
    },
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching extension...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
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
      '.png': 'dataurl',
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

// Copy sql.js WASM file to output
function copySqlJsWasm() {
  const wasmSource = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const wasmDest = path.join(__dirname, 'out', 'sql-wasm.wasm');
  if (fs.existsSync(wasmSource)) {
    fs.copyFileSync(wasmSource, wasmDest);
    console.log('Copied sql-wasm.wasm to out/');
  }
}

async function main() {
  fs.mkdirSync('out/webview', { recursive: true });
  buildTailwind();
  await buildExtension();
  await buildWebview();
  copySqlJsWasm();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
