@echo off
setlocal
set "NODE_BIN=C:\Users\Core\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "PNPM_CJS=C:\Users\Core\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs"
set "PATH=%NODE_BIN%;%PATH%"
"%NODE_BIN%\node.exe" "%PNPM_CJS%" %*
