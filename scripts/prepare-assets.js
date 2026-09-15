const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = path.resolve(__dirname, '..');
const dest = path.join(root, 'miniprogram/assets');
fs.mkdirSync(dest, { recursive: true });
const icons = {
  menu: '<path d="M3 11h18a9 9 0 0 1-18 0Zm4 10h10M8 7c-3-3 3-3 0-6m6 6c-3-3 3-3 0-6m4 7 3-5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  book: '<path d="M4 3h13a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 14h15M7 7h8m-8 4h5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  filter: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="2" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="2" fill="currentColor" stroke="none"/>'
};
async function main() {
  for(const name of ['logo','bowls']) await sharp(path.join(root,`public/assets/${name}.svg`)).resize(name==='logo'?128:730).png().toFile(path.join(dest,`${name}.png`));
  for(const [name,paths] of Object.entries(icons)) for(const active of [false,true]) {
    const color=active?'#d6845c':'#98a184';
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${color}" color="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(dest,`${name}${active?'-active':''}.png`));
  }
  await sharp({create:{width:500,height:400,channels:4,background:'#f4eee2'}}).composite([{input:await sharp(path.join(dest,'bowls.png')).resize(470).toBuffer(),left:15,top:60}]).png().toFile(path.join(dest,'share.png'));
  console.log('小程序图形资源已生成');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
