import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const checkedRoots = ["src", "tests", "scripts", "docs"] as const;
const conventionalNames = new Set(["index.ts"]);
const kebabCaseFileName = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const failures: string[] = [];

for (const root of checkedRoots) {
  checkDirectory(root);
}

if (failures.length > 0) {
  throw new Error(`Expected kebab-case filenames:\n${failures.join("\n")}`);
}

function checkDirectory(directory: string): void {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      checkDirectory(path);
      continue;
    }

    const name = basename(path);
    if (conventionalNames.has(name) || kebabCaseFileName.test(name)) {
      continue;
    }

    failures.push(path);
  }
}
