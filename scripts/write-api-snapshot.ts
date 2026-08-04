import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildSnapshotFromDist, snapshotLabel, snapshotPath } from "./api-snapshot.ts";

mkdirSync(dirname(snapshotPath), { recursive: true });
writeFileSync(snapshotPath, buildSnapshotFromDist());
process.stdout.write(`Wrote ${snapshotLabel}\n`);
