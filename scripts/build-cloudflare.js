const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
if (fs.existsSync(output)) {
  const resolved = path.resolve(output);
  if (path.dirname(resolved) !== root || path.basename(resolved) !== 'dist') throw new Error('拒绝清理意外的输出目录');
  fs.rmSync(resolved, { recursive: true, force: true });
}
fs.cpSync(path.join(root, 'public'), output, { recursive: true });
const shared = path.join(output, 'shared');
fs.mkdirSync(shared, { recursive: true });
for (const file of ['model.js', 'presentation.js']) {
  fs.copyFileSync(path.join(root, 'miniprogram', 'utils', file), path.join(shared, file));
}
console.log(`Cloudflare 静态资源已生成：${path.relative(root, output)}`);
