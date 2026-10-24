// Isolate module registration without rewriting any rule or AI function.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = await fs.readFile(path.join(root, "mobile/index.android.bundle"));
const digest = crypto.createHash("sha256").update(data).digest("hex");
if (
  digest !== "027d40cea4063f4d1e8c2658319adf6ec2eee3492c96291814963278ab61c07c"
)
  throw Error("Unsupported APK bundle; refusing to patch a different version");
// Function 0: stop before native UI entry-point __r calls. Verified with isolate-mobile.py.
const offset = 0x2a0c08 + 0x42066;
if (data.subarray(offset, offset + 2).toString("hex") !== "4808")
  throw Error("Unexpected startup instruction");
data.set([0x76, 0x07], offset); // Ret r7, copied from the end of this function.
crypto
  .createHash("sha1")
  .update(data.subarray(0, -20))
  .digest()
  .copy(data, data.length - 20);
await fs.mkdir(path.join(root, "generated"), { recursive: true });
await fs.writeFile(path.join(root, "generated/rules.hbc"), data);
console.log(
  "Prepared original APK rules; changed startup instruction and HBC checksum only.",
);
