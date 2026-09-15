// Run with the server stopped. Only built-in image paths change; room choices remain intact.
const fs=require('node:fs'),path=require('node:path');
const {dishes}=require('../miniprogram/utils/model');
const file=path.join(process.env.DATA_DIR||path.resolve(__dirname,'../.data'),'rooms.json');
const images=new Map(dishes.map(d=>[d.id,d.image]));
for(const image of images.values())for(const folder of ['public','miniprogram'])if(!fs.existsSync(path.resolve(__dirname,'..',folder,'.'+image)))throw new Error('Missing image: '+image);
if(fs.existsSync(file)){
  const rooms=JSON.parse(fs.readFileSync(file,'utf8'));let changed=0;
  for(const room of Object.values(rooms)){
    const previous=JSON.stringify(room);
    const items=[...room.dishes,...(room.history||[]).map(h=>h.dish),room.proposal?.dish,...(room.orders||[]).flatMap(o=>o.items.map(i=>i.dish))].filter(Boolean);
    for(const dish of items)if(!dish.custom&&images.has(dish.id))dish.image=images.get(dish.id);
    if(previous!==JSON.stringify(room)){room.version++;room.updatedAt=Date.now();changed++;}
  }
  if(changed){fs.copyFileSync(file,`${file}.before-images-${Date.now()}.bak`);fs.writeFileSync(`${file}.tmp`,JSON.stringify(rooms));fs.renameSync(`${file}.tmp`,file);}
  console.log(`Updated images in ${changed} rooms.`);
}
