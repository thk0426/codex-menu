// Start one local preview host and verify it is ready. Running this again reuses the same host.
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const address = 'http://localhost:3000';
async function healthy() {
  try {
    const response = await fetch(`${address}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok || !(await response.json()).ok) return false;
    const page = await fetch(address, { signal: AbortSignal.timeout(1500) });
    return page.ok && (await page.text()).includes('心动菜单');
  } catch { return false; }
}
function startHost() {
  const entry = path.join(root, 'scripts', 'preview-server.js');
  if (!fs.existsSync(entry)) throw new Error('Preview server entry is missing.');
  if (process.platform === 'win32') {
    // Win32_Process creates an independent Windows process, so ending a terminal does not end the server.
    // Quote PowerShell literals separately from the executable's Windows command line.
    const psLiteral = value => "'" + value.replace(/'/g, "''") + "'";
    const commandLine = `"${process.execPath}" "${entry}"`;
    const command = [
      "$ErrorActionPreference = 'Stop'",
      '$menuStartup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }',
      `$menuLaunch = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${psLiteral(commandLine)}; CurrentDirectory = ${psLiteral(root)}; ProcessStartupInformation = $menuStartup }`,
      '$menuLaunch | Select-Object ReturnValue, ProcessId | ConvertTo-Json -Compress'
    ].join('\n');
    const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const result = JSON.parse(execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, encoding: 'utf8', timeout: 15000 }).trim());
    if (result.ReturnValue !== 0) throw new Error(`Windows could not start the preview (code ${result.ReturnValue}).`);
    console.log(`Preview host started: PID ${result.ProcessId}`);
  } else {
    const child = spawn(process.execPath, [entry], { cwd: root, detached: true, stdio: 'ignore' });
    child.unref();
    console.log(`Preview host started: PID ${child.pid}`);
  }
}
(async () => {
  if (await healthy()) { console.log(`Preview is already running: ${address}/`); return; }
  startHost();
  for (let attempt = 0; attempt < 20; attempt++) {
    if (await healthy()) { console.log(`Preview is ready: ${address}/`); return; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Preview did not become ready. Check whether port 3000 is occupied and see artifacts/preview-service.log.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
