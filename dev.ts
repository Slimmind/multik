import { spawn } from "child_process";
import fs from 'fs';
import path from 'path';

console.log("Starting Multik Dev Server...");

// Generate version file from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const versionContent = `// This file is auto-generated during build
export const VERSION = '${packageJson.version}';
`;
fs.writeFileSync('src/version.ts', versionContent);

// 1. Initial Build & Watch
// We use a simplified bundler logic here for watch mode or spawn the bundler logic
// Bun.build doesn't have a built-in "watch" CLI flag, but we can wrap it.
// Easiest is to re-run build on file change, or just use Bun.build calls.

const build = async () => {
    // Re-use logic from bundler.ts essentially, or better:
    // Just run the bundler.ts as a one-off, then restart it?
    // Actually, properly let's just use Bun.build inside here.

    // Ensure dist exists
    if (!fs.existsSync('dist')) fs.mkdirSync('dist');

    // Copy HTML/Assets
    const htmlOrg = fs.readFileSync('index.html', 'utf8');
    let html = htmlOrg.replace(
        '<script type="module" src="/src/main.tsx"></script>',
        `<script type="module" src="/main.js"></script>`
    );
     // Note: In dev we might not have CSS extracted if minification/etc logic differs,
     // but Bun.build usually extracts CSS if it's imported.

    const assets = [{ src: 'public/favicon.svg', dest: 'favicon.svg' }];
    assets.forEach(asset => {
        if (fs.existsSync(asset.src)) {
            fs.copyFileSync(asset.src, path.join('dist', asset.dest));
        }
    });

    const result = await Bun.build({
        entrypoints: ['./src/main.tsx'],
        outdir: './dist',
        minify: false, // Faster for dev
        target: 'browser',
        naming: {
            entry: '[dir]/[name].[ext]',
        },
    });

    // Inject CSS
    const cssFile = result.outputs.find(out => out.path.endsWith('.css'));
    if (cssFile) {
        const cssFileName = path.basename(cssFile.path);
        if (!html.includes(cssFileName)) {
             html = html.replace('</head>', `<link rel="stylesheet" href="/${cssFileName}">\n</head>`);
        }
    }
    fs.writeFileSync('dist/index.html', html);

    if (!result.success) {
        console.error("Build failed:", result.logs);
    } else {
        console.log(`Build updated at ${new Date().toLocaleTimeString()}`);
    }
};

// Initial build
await build();

// Watch src folder with debounce
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_DELAY = 300;

const watcher = fs.watch('./src', { recursive: true }, async (event, filename) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        await build();
    }, DEBOUNCE_DELAY);
});
console.log("Watching for changes in src...");


// 2. Run Server
const server = spawn("bun", ["server.ts"], {
    stdio: "inherit",
    env: { ...process.env }
});

server.on("close", (code) => {
    process.exit(code);
});

// Handle exit
process.on("SIGINT", () => {
    server.kill();
    watcher.close();
    process.exit();
});
