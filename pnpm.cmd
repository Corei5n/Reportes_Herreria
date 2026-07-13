@echo off
setlocal
set "NODE_EXE=C:\Users\Core\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "PNPM_CJS=C:\Users\Core\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs"
"%NODE_EXE%" "%PNPM_CJS%" %*
