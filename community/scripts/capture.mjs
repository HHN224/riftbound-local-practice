import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
const root = new URL('../upstream/', import.meta.url);
const origin = 'https://letstcg.xyz';
const queue = ['/fuxuan/'];
const seen = new Set();
const manifest = [];
while (queue.length) {
  const url = queue.shift();
  if(seen.has(url)) continue;
  seen.add(url);
  const response = await fetch(origin + url);
  if(!response.ok) throw new Error(`${url}: ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  const relative = url.endsWith('/') ? url + 'index.html' : url;
  const file = new URL('.' + relative, root);
  await fs.mkdir(path.dirname(fileURLToPath(file)), {recursive:true});
  await fs.writeFile(file, data);
  manifest.push({url:origin+url,path:relative.slice(1),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
  if(/\.(js|html)$/.test(relative)) {
    const text=data.toString();
    for(const match of text.matchAll(/["'](\/fuxuan\/[^"'\s]+\.(?:js|css|png|ico|webmanifest))["']/g)) queue.push(match[1]);
  }
}
await fs.writeFile(new URL('../research/resource-manifest.json',import.meta.url),JSON.stringify({source:origin+'/fuxuan/',capturedAt:new Date().toISOString(),files:manifest},null,2)+'\n');
console.log(`Saved ${manifest.length} public resources`);

