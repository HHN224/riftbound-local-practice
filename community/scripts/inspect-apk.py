"""Inspect user-supplied APK without executing it; retain provenance and engine symbol evidence."""
import argparse, hashlib, json, pathlib, struct, zipfile
p = argparse.ArgumentParser()
p.add_argument('apk', type=pathlib.Path)
a = p.parse_args()
root = pathlib.Path(__file__).resolve().parents[1]
with zipfile.ZipFile(a.apk) as z:
    bundle = z.read('assets/index.android.bundle')
    for name in ('index.android.bundle', 'app.config', 'app.manifest'):
        (root / 'mobile').mkdir(exist_ok=True)
        (root / 'mobile' / name).write_bytes(z.read('assets/' + name))
    config = json.loads(z.read('assets/app.config'))
report = {
    'sourceFile': a.apk.name,
    'apkBytes': a.apk.stat().st_size,
    'apkSha256': hashlib.file_digest(a.apk.open('rb'), 'sha256').hexdigest(),
    'package': config.get('android', {}).get('package'),
    'configVersion': config.get('version'),
    'bundleBytes': len(bundle),
    'bundleSha256': hashlib.sha256(bundle).hexdigest(),
    'hermesMagic': bundle[:8].hex(),
    'bytecodeVersion': struct.unpack_from('<I', bundle, 8)[0],
    'symbols': {s: bundle.find(s.encode()) for s in (
        'createLocalGameHost', 'createWorkerLocalGameHost', 'createRoutedGameTransport',
        'resolveCombatDamage', 'aiDifficulty', 'aiStrategy', 'initSandbox')},
    'limitations': 'String presence is static evidence only; not a full offline gameplay test.'
}
(root / 'research' / 'mobile-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
