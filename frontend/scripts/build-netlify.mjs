import { readdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const clientDir = join(projectRoot, "dist/client");
const assetDir = join(clientDir, "assets");

function pickFile(pattern) {
  const entries = readdirSync(assetDir).filter((name) => pattern.test(name));
  return entries[0] ?? null;
}

const entryFile = pickFile(/^index-.*\.js$/);
const cssFile = pickFile(/^(index|styles)-.*\.css$/);

if (!entryFile) {
  throw new Error("Could not find the built client entry script in dist/client/assets");
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PGMS</title>
    ${cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${entryFile}"></script>
  </body>
</html>
`;

writeFileSync(join(clientDir, "index.html"), html);
copyFileSync(join(projectRoot, "public", "_redirects"), join(clientDir, "_redirects"));
