import fs from 'fs';
import path from 'path';

// Generate version file from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const versionContent = `// This file is auto-generated during build
export const VERSION = '${packageJson.version}';
`;
fs.writeFileSync('src/version.ts', versionContent);

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.mkdirSync('dist');

// Copy public assets
const assets = [{ src: 'public/favicon.svg', dest: 'favicon.svg' }];
assets.forEach(asset => {
    if (fs.existsSync(asset.src)) {
        fs.copyFileSync(asset.src, path.join('dist', asset.dest));
    }
});

const build = await Bun.build({
  entrypoints: ['./src/main.tsx'],
  outdir: './dist',
  minify: true,
  target: 'browser',
  naming: {
      entry: '[dir]/[name].[ext]',
      chunk: '[dir]/[name]-[hash].[ext]',
      asset: '[dir]/[name]-[hash].[ext]', // Bun handles imported CSS as assets
  },
  plugins: [], // Add plugins if needed
});

if (!build.success) {
  console.error("Build failed");
  for (const message of build.logs) {
    console.error(message);
  }
  process.exit(1);
}

// Process index.html
let html = fs.readFileSync('index.html', 'utf8');

// Replace standard Vite script with built script
// Note: Bun output for main.tsx will likely be main.js and main.css (if css imported)
html = html.replace(
    '<script type="module" src="/src/main.tsx"></script>',
    `<script type="module" src="/main.js"></script>`
);

// Inject CSS if strict output
const cssFile = build.outputs.find(out => out.path.endsWith('.css'));
if (cssFile) {
    // Bun returns absolute path in build.outputs
    const cssFileName = path.basename(cssFile.path);
    html = html.replace('</head>', `<link rel="stylesheet" href="/${cssFileName}">\n</head>`);
}

fs.writeFileSync('dist/index.html', html);

console.log("Build successful!");
