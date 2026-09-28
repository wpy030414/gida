/**
 * Final E2E: git → yida → git, byte-perfect roundtrip.
 * Single process, no cross-run contamination.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TMP = mkdtempSync(join(tmpdir(), 'gry-final-'));
const SRC = TMP.replace(/\\/g, '/') + '/src';
const REM = TMP.replace(/\\/g, '/') + '/remote';
const CLN = TMP.replace(/\\/g, '/') + '/clone';

const B = (cmd: string) => spawnSync('bash', ['-c', cmd], { stdio: 'pipe' }).stdout.toString();
const Bb = (cmd: string) => spawnSync('bash', ['-c', cmd], { stdio: 'pipe' }).stdout;

try {
  // ═══════════════════════════════════════════════
  // STEP 1: Source repo (no GPG, no CRLF)
  // ═══════════════════════════════════════════════
  console.log('═══ 1. Source Repo ═══');
  B(`mkdir -p '${SRC}' && git -C '${SRC}' init && git -C '${SRC}' config commit.gpgsign false && git -C '${SRC}' config tag.gpgsign false && git -C '${SRC}' config core.autocrlf false && git -C '${SRC}' config user.name "E2E" && git -C '${SRC}' config user.email "e2e@test"`);
  B(`cd '${SRC}' && printf "# Hello World\\n" > README.md && git add README.md && git -c commit.gpgsign=false commit -m "first"`);
  B(`cd '${SRC}' && mkdir -p src/lib && printf "export const x = 42;\\n" > src/lib/util.ts && git add src/lib/util.ts && git -c commit.gpgsign=false commit -m "add util"`);
  B(`cd '${SRC}' && echo "node_modules/" > .gitignore && git add .gitignore && git -c commit.gpgsign=false commit -m "add gitignore"`);

  const srcLog = B(`cd '${SRC}' && git log --oneline`);
  const srcHEAD = B(`cd '${SRC}' && git rev-parse HEAD`).trim();
  console.log(srcLog);
  console.log('HEAD:', srcHEAD.slice(0, 8));

  // ═══════════════════════════════════════════════
  // STEP 2: Push to Yida
  // ═══════════════════════════════════════════════
  console.log('\n═══ 2. Push to Yida ═══');
  const fe = B(`cd '${SRC}' && git fast-export --all`);

  const pushP = spawnSync('node', ['dist/index.js', 'yida::x/x/x'], {
    env: { ...process.env, YIDA_LOCAL: '1', YIDA_GIT_DIR: REM },
    stdio: 'pipe',
    input: 'capabilities\n\nlist for-push\n\npush refs/heads/master\n\n' + fe,
  });
  const pushOK = pushP.stdout.toString().includes('ok refs/heads/master');
  console.log('Push:', pushOK ? '✅' : '❌');
  if (!pushOK) { console.log(pushP.stdout.toString()); process.exit(1); }

  // ═══════════════════════════════════════════════
  // STEP 3: Verify stored SHA === source HEAD
  // ═══════════════════════════════════════════════
  const listP = spawnSync('node', ['dist/index.js', 'yida::x/x/x'], {
    env: { ...process.env, YIDA_LOCAL: '1', YIDA_GIT_DIR: REM },
    stdio: 'pipe',
    input: 'capabilities\n\nlist\n\n',
  });
  const m = listP.stdout.toString().match(/^([0-9a-f]{40}) (refs\/heads\/\S+)/m);
  if (!m) { console.log('List failed:', listP.stdout.toString()); process.exit(1); }
  const storedSHA = m[1];
  const shaMatch = storedSHA === srcHEAD;
  console.log('Stored SHA:', storedSHA.slice(0, 8), shaMatch ? '✅ === source HEAD' : '❌ ≠ source HEAD');
  if (!shaMatch) { console.log('  src:', srcHEAD, '\n  sto:', storedSHA); process.exit(1); }

  // ═══════════════════════════════════════════════
  // STEP 4: Fetch (must be byte-identical to orig)
  // ═══════════════════════════════════════════════
  console.log('\n═══ 3. Fetch from Yida ═══');
  const fetchP = spawnSync('node', ['dist/index.js', 'yida::x/x/x'], {
    env: { ...process.env, YIDA_LOCAL: '1', YIDA_GIT_DIR: REM },
    stdio: 'pipe',
    input: 'capabilities\n\nfetch ' + storedSHA + ' refs/heads/master\n\n',
    timeout: 30000,
  });

  const dbl = fetchP.stdout.indexOf('\n\n');
  const feBody = fetchP.stdout.subarray(dbl + 2);
  const feIdentical = feBody.length === fe.length && Buffer.compare(feBody, Buffer.from(fe)) === 0;
  console.log('Fetch output:', feIdentical ? '✅ IDENTICAL to original fast-export' : `❌ DIFF (${feBody.length} vs ${fe.length})`);
  if (!feIdentical) { process.exit(1); }

  // ═══════════════════════════════════════════════
  // STEP 5: Clone (import + checkout)
  // ═══════════════════════════════════════════════
  console.log('\n═══ 4. Clone ═══');
  const feFile = TMP.replace(/\\/g, '/') + '/fe.bin';
  writeFileSync(feFile, feBody);

  const imp = B(`rm -rf '${CLN}' && git -c commit.gpgsign=false init '${CLN}' >/dev/null 2>&1 && git -C '${CLN}' config commit.gpgsign false && git -C '${CLN}' config tag.gpgsign false && git -C '${CLN}' config core.autocrlf false && cd '${CLN}' && git fast-import --quiet < '${feFile}' 2>&1; echo "EXIT:$?"`);
  if (!imp.includes('EXIT:0')) { console.log('❌ Import failed:', imp); process.exit(1); }
  console.log('Import:', '✅');

  B(`cd '${CLN}' && git checkout -f master 2>&1`);
  const cloneHEAD = B(`cd '${CLN}' && git rev-parse HEAD`).trim();
  const cloneLog = B(`cd '${CLN}' && git log --oneline`);
  console.log(cloneLog);
  console.log('Clone HEAD:', cloneHEAD.slice(0, 8));

  // ═══════════════════════════════════════════════
  // VERIFY
  // ═══════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════');
  const finalMatch = srcHEAD === cloneHEAD;
  if (finalMatch) {
    console.log('🎉 FULL ROUNDTRIP PASSED');
    console.log(`   ${srcHEAD.slice(0,8)} → yida → ${cloneHEAD.slice(0,8)}  (SHA IDENTICAL)`);
    console.log('   Push: ✅  Fetch: ✅  Clone: ✅');
  } else {
    console.log('❌ SHA MISMATCH');
    console.log('   src:', srcHEAD, '\n   cln:', cloneHEAD);
    process.exit(1);
  }

} finally {
  rmSync(TMP, { recursive: true, force: true });
}