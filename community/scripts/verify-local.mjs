import fs from "node:fs/promises";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const read = (relative) =>
  fs.readFile(new URL("../" + relative, import.meta.url));
const sha = (data) => crypto.createHash("sha256").update(data).digest("hex");
const original = await read("mobile/index.android.bundle");
assert.equal(
  sha(original),
  "027d40cea4063f4d1e8c2658319adf6ec2eee3492c96291814963278ab61c07c",
);
const generated = await read("generated/rules.hbc");
assert.equal(original.length, generated.length);
const differences = [];
for (let i = 0; i < original.length - 20; i++)
  if (original[i] !== generated[i]) differences.push(i);
assert.deepEqual(
  differences,
  [3026030, 3026031],
  "Only the native startup instruction may differ",
);
assert.equal(generated.subarray(3026030, 3026032).toString("hex"), "7607");
assert(
  generated
    .subarray(-20)
    .equals(
      crypto.createHash("sha1").update(generated.subarray(0, -20)).digest(),
    ),
);
const assets = JSON.parse(await read("research/mobile-assets.json"));
assert.deepEqual(assets.missing, []);
for (const file of assets.files)
  assert.equal(sha(await read(file.path)), file.sha256, file.path);
assert(
  (await read("engine/bin/hermes-fuxuan.exe"))
    .subarray(0, 2)
    .equals(Buffer.from("MZ")),
);
console.log(
  `Verified original rule bytecode, isolated startup and ${assets.files.length} local APK assets.`,
);
