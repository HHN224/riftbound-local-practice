import pathlib,zipfile,json,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/'mobile/app.manifest').read_text(encoding='utf8'))
resource_paths=json.loads((root/'research/android-asset-paths.json').read_text(encoding='utf8'))
with zipfile.ZipFile(root/'installers/application-1020.apk') as z:
 byhash={}
 for name in z.namelist():
  if name.startswith('res/') and name.endswith(('.webp','.png','.wav','.ogg')):
   data=z.read(name);byhash[hashlib.md5(data).hexdigest()]=(name,data)
 entries=[];missing=[]
 for a in manifest['assets']:
  found=byhash.get(a['packagerHash'])
  # Android re-encodes PNGs; paths are captured via aapt dump resources.
  resource=resource_paths.get(a['resourcesFolder']+'/'+a['resourcesFilename'])
  if not found and resource:found=(resource,z.read(resource))
  if not found:missing.append(a['name']);continue
  folder='card-images' if 'card-images-compressed' in a['subdirectory'] else 'cardbacks' if 'cardbacks' in a['subdirectory'] else 'media'
  dest=root/'public'/folder/(a['name']+'.'+a['type']);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(found[1])
  entries.append({'path':str(dest.relative_to(root)).replace('\\','/'),'apkEntry':found[0],'sha256':hashlib.sha256(found[1]).hexdigest()})
(root/'research/mobile-assets.json').write_text(json.dumps({'extracted':len(entries),'missing':missing,'files':entries},ensure_ascii=False,indent=2),encoding='utf8')
print('Extracted',len(entries),'missing',missing[:20])
