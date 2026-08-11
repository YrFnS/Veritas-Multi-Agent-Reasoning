import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const assetDirectory = join(process.cwd(), 'dist', 'assets');
const limits = {
  maxJavaScriptFileBytes: 300 * 1024,
  maxTotalJavaScriptBytes: 450 * 1024,
  maxTotalCssBytes: 160 * 1024,
};

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const escapeWorkflowCommand = (value) =>
  value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

let assetNames;
try {
  assetNames = readdirSync(assetDirectory);
} catch {
  console.error('Bundle check failed: dist/assets does not exist. Run npm run build first.');
  process.exit(1);
}

const assets = assetNames
  .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
  .map((name) => {
    const filePath = join(assetDirectory, name);
    const bytes = statSync(filePath).size;
    const gzipBytes = gzipSync(readFileSync(filePath)).length;
    return { name, bytes, gzipBytes };
  })
  .sort((left, right) => right.bytes - left.bytes);

if (assets.length === 0) {
  console.error('Bundle check failed: no JavaScript or CSS assets were emitted.');
  process.exit(1);
}

console.log('Production asset sizes:');
for (const asset of assets) {
  console.log(
    `- ${asset.name}: ${formatBytes(asset.bytes)} raw / ${formatBytes(asset.gzipBytes)} gzip`
  );
}

const javascriptAssets = assets.filter((asset) => asset.name.endsWith('.js'));
const cssAssets = assets.filter((asset) => asset.name.endsWith('.css'));
const totalJavaScriptBytes = javascriptAssets.reduce(
  (total, asset) => total + asset.bytes,
  0
);
const totalCssBytes = cssAssets.reduce((total, asset) => total + asset.bytes, 0);
const errors = [];

for (const asset of javascriptAssets) {
  if (asset.bytes > limits.maxJavaScriptFileBytes) {
    errors.push(
      `${asset.name} is ${formatBytes(asset.bytes)}; the per-file JavaScript limit is ${formatBytes(limits.maxJavaScriptFileBytes)}.`
    );
  }
}

if (totalJavaScriptBytes > limits.maxTotalJavaScriptBytes) {
  errors.push(
    `Total JavaScript is ${formatBytes(totalJavaScriptBytes)}; the limit is ${formatBytes(limits.maxTotalJavaScriptBytes)}.`
  );
}

if (totalCssBytes > limits.maxTotalCssBytes) {
  errors.push(
    `Total CSS is ${formatBytes(totalCssBytes)}; the limit is ${formatBytes(limits.maxTotalCssBytes)}.`
  );
}

if (errors.length > 0) {
  console.error('\nBundle budget exceeded:');
  for (const error of errors) {
    console.error(`- ${error}`);
    console.error(
      `::error file=scripts/check-bundle-size.mjs,title=Bundle budget exceeded::${escapeWorkflowCommand(error)}`
    );
  }
  process.exit(1);
}

console.log(
  `Bundle budget passed: ${formatBytes(totalJavaScriptBytes)} JavaScript and ${formatBytes(totalCssBytes)} CSS.`
);
