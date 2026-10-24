import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const manifest=JSON.parse(await fs.readFile(new URL('../research/resource-manifest.json',import.meta.url),'utf8'));
for(const entry of manifest.files){
 const bytes=await fs.readFile(new URL('../upstream/'+entry.path,import.meta.url));
 if(bytes.length!==entry.bytes || crypto.createHash('sha256').update(bytes).digest('hex')!==entry.sha256) throw Error('Snapshot mismatch: '+entry.path);
}
console.log(`Verified ${manifest.files.length} upstream files; no engine completeness claim.`);
