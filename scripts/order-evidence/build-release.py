#!/usr/bin/env python3
"""Create a deterministic API-only source tree from the reviewed active baseline."""
import argparse, hashlib, json, pathlib, shutil, sys
p=argparse.ArgumentParser(); p.add_argument('--baseline',required=True,type=pathlib.Path); p.add_argument('--output',required=True,type=pathlib.Path); a=p.parse_args()
base=a.baseline.resolve(); out=a.output.resolve(); repo=pathlib.Path(__file__).resolve().parents[2]
if out.exists() or base == out or base in out.parents: sys.exit('Output must be a new directory outside the baseline')
expected={'server/index.mjs':'33be26c6460ef99cccfd40a8188ad9d4526fb424b08aec9f111456ce3e9f275d','server/lib/db.mjs':'665145c5acbc8d0841fa5976cb07fd287d100b8f0a037471bf5098b73df450ed','package-lock.json':'8d5f5c1adee76796cab16fe73dceb5cf4d13d5da817961d505546cce0b3a87fa'}
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
for path, value in expected.items():
 if digest(base/path)!=value: sys.exit('Baseline mismatch: '+path)
for f in base.rglob('*'):
 if f.is_symlink(): sys.exit('Symlinks not accepted: '+str(f.relative_to(base)))
 if f.is_file() and (f.name.startswith('.env') or '.bak' in f.name or '.backup' in f.name or f.suffix in ('.pem','.key')): sys.exit('Unexpected sensitive/backup file: '+str(f.relative_to(base)))
if not (base/'server').is_dir(): sys.exit('Missing server directory')
out.mkdir(parents=True)
shutil.copytree(base/'server',out/'server'); shutil.copy2(base/'package.json',out/'package.json'); shutil.copy2(base/'package-lock.json',out/'package-lock.json')
index=out/'server/index.mjs'; s=index.read_text(); marker="app.use('/api/orders', createOrdersRouter())"; imp="import { createMarketingOrderEvidenceRouter } from './routes/marketing-order-evidence.mjs'\n"
if s.count(marker)!=1 or imp in s: sys.exit('Unexpected baseline route layout')
index.write_text(imp+s.replace(marker,"app.use('/api/internal/direct', createMarketingOrderEvidenceRouter())\n"+marker))
for rel in ['server/lib/db.mjs','server/lib/marketing-order-evidence.mjs','server/routes/marketing-order-evidence.mjs']:
 src=repo/rel; dest=out/rel
 if rel != 'server/lib/db.mjs' and dest.exists(): sys.exit('Overlay already exists: '+rel)
 shutil.copy2(src,dest)
manifest={str(f.relative_to(out)):{'sha256':digest(f),'mode':format(f.stat().st_mode & 0o777, '04o')} for f in sorted(out.rglob('*')) if f.is_file()}
(out/'SHA256SUMS.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n'); (out/'SHA256SUMS.json').chmod(0o644)
print('files:',len(manifest),'manifest-sha256:',digest(out/'SHA256SUMS.json'))
