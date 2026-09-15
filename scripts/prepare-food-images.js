// Source PNGs are retained locally in artifacts/food-originals; optimized exports are bundled.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..');
async function main(){
  const manifest=require('../docs/food-image-prompts.json');
  for(const food of manifest.foods){
    const source=path.join(root,`artifacts/food-originals/${food.id}.png`);
    if(!fs.existsSync(source))throw new Error('Original PNGs are required to re-export images. The project already includes all optimized JPGs.');
    for(const [target,width,quality] of [[food.web,900,83],[food.native,480,67]]){
      fs.mkdirSync(path.dirname(path.join(root,target)),{recursive:true});
      await sharp(source).resize({width,withoutEnlargement:true}).jpeg({quality,mozjpeg:true}).toFile(path.join(root,target));
    }
  }
  for(const [target,width,quality] of [[manifest.hero.web,1440,86],[manifest.hero.native,900,72]])await sharp(path.join(root,'artifacts/food-originals/hero.png')).resize({width}).jpeg({quality,mozjpeg:true}).toFile(path.join(root,target));
  console.log(`Exported ${manifest.foods.length} dish images and the hero for web and WeChat.`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
