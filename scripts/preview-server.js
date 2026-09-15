// Standalone local preview host. The Windows launcher starts it outside the command session.
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('../server');
const root = path.resolve(__dirname, '..');
const logs = path.join(root, 'artifacts');
fs.mkdirSync(logs, { recursive: true });
const log = message => fs.appendFileSync(path.join(logs, 'preview-service.log'), `${new Date().toISOString()} ${message}\n`);
const server = createApp({ dataDir: path.join(root, '.data') });
server.on('error', error => { log(`ERROR ${error.code || ''}: ${error.message}`); process.exitCode = 1; });
server.listen(3000, '0.0.0.0', () => {
  fs.writeFileSync(path.join(logs, 'preview-process.json'), JSON.stringify({ pid: process.pid, port: 3000, startedAt: new Date().toISOString() }, null, 2));
  log(`Preview started, PID ${process.pid}, http://localhost:3000/`);
});
