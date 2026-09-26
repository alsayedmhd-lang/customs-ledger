const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "package.json");
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));

if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) {
  throw new Error(`Invalid version: ${pkg.version}`);
}

let [major, minor, patch] = pkg.version.split(".").map(Number);

patch += 1;
minor += Math.floor(patch / 100);
patch %= 100;

major += Math.floor(minor / 10);
minor %= 10;

const previous = pkg.version;
pkg.version = `${major}.${minor}.${patch}`;

fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log(`Version: ${previous} -> ${pkg.version}`);