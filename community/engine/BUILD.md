# Local Hermes host

The Windows x64 executable in `bin/` runs the supplied APK's original Hermes v98 bytecode. It does not implement card rules. `host.cpp` provides JSON-lines I/O, a JavaScript runtime and microtask draining; `bootstrap.js` supplies the timer and production environment globals normally provided by React Native/Expo. `session.js` calls the original `LocalGameHost` module (4097).

## Rebuild

Prerequisites: Visual Studio 2022 C++ x64 tools, Python, CMake 4.4.4 and Ninja 1.13.2. The working tools environment was created with:

```powershell
python -m venv community/tools/venv
community/tools/venv/Scripts/pip.exe install cmake==4.4.4 ninja==1.13.2 hermes-dec==0.1.8
```

Download and extract Hermes commit `40b4c8d4e22ed2b9af46aba81aec3ca8aa5e169c` from `https://codeload.github.com/facebook/hermes/tar.gz/40b4c8d4e22ed2b9af46aba81aec3ca8aa5e169c` into `community/tools/`. Then:

```powershell
powershell -ExecutionPolicy Bypass -File community/scripts/Build-Host.ps1
node community/scripts/prepare-engine.mjs
```

The build script adds the host target and removes two GCC-only branch prediction hints from `static_h.h` for MSVC. These are runtime build adaptations, not changes to the author's game code. It disables the debugger and Intl and uses UnicodeLite. The bundled executable was tested on this Windows machine; portability to other operating systems has not been tested.

## Bytecode provenance

`mobile/index.android.bundle` stays unchanged. Its SHA-256 must equal `027d40cea4063f4d1e8c2658319adf6ec2eee3492c96291814963278ab61c07c` before preparation is allowed. `prepare-engine.mjs` replaces only two bytes at offset 3026030: the native application startup is replaced by the function's own return instruction. The last 20 bytes are the recomputed HBC checksum. All registered module bodies, including rules and AI, remain byte-for-byte identical.

`scripts/isolate-mobile.py` is the independent disassembly-based discovery tool and records module IDs/dependencies in `research/mobile-modules.json`. It requires hermes-dec; normal startup does not. The generated HBC is ignored by Git and recreated locally.

Hermes and third-party runtime license notices are in `licenses/`. Community game code and art retain their original ownership; this workspace is a local adaptation of user-supplied artifacts, not an upstream source release.
