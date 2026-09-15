// Compatibility check: all current images are bundled; no external image download is needed.
const fs=require('fs'),path=require('path');
const {dishes}=require('../miniprogram/utils/model');
for(const d of dishes)if(!fs.existsSync(path.join(__dirname,'../miniprogram',d.image)))throw new Error('Missing image: '+d.image);
console.log(dishes.length+' dish images are already bundled locally.');
