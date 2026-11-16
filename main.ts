// Hands the frontend in (Node 22, standard library only). The entry is the static files under
// this directory's app/ plus the screenshots/ the maker took of it running on live data; this
// program copies both into the output directory and writes dossier.json, the summary the judge
// reads — the screenshots, the first load's files and bytes, and the source — built with the
// vendored make.fun library. Leave vendor/makefun-frontend.ts exactly as the kit shipped it:
// the scorer rebuilds the dossier with its own copy and requires a byte-for-byte match.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// In the grader's container MAKEFUN_OUTPUT_DIR is unset and the output goes to /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repo = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, so a run here refuses exactly what the scorer would refuse:
// at most 3 screenshots of 256 KiB, app/ within 993 files and directories and 16 MiB,
// and the dossier text capped at 160 KiB. /output itself is capped at 1,000 entries and
// 64 MiB, which app/, screenshots/ and dossier.json share.
const dossierOptions = {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
};

function handIn() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repo, 'app'), join(outDir, 'app'), { recursive: true });
  const shots = join(repo, 'screenshots');
  if (existsSync(shots)) cpSync(shots, join(outDir, 'screenshots'), { recursive: true });
  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, dossierOptions));
}

handIn();
