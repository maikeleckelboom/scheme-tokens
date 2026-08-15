import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { packageRoot, repoRoot } from "./api-snapshot.ts";

execFileSync(
  process.execPath,
  [
    join(repoRoot, "node_modules", "vitest", "vitest.mjs"),
    "run",
    "--config",
    "vitest.config.ts",
    "tests/golden.test.ts",
    "tests/engine-contract.test.ts",
  ],
  {
    cwd: packageRoot,
    env: { ...process.env, MATERIAL3_WRITE_FIXTURES: "1" },
    stdio: "inherit",
  },
);
