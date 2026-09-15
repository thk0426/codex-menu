const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:3000',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.heart-dish');await page.waitForTimeout(3500);
  fs.mkdirSync(path.resolve('artifacts'),{recursive:true});
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  console.log(JSON.stringify({errors,images:await page.locator('.dish-thumb img').evaluateAll(imgs=>imgs.map(i=>({alt:i.alt,loaded:i.complete&&i.naturalWidth>0,src:i.src}))),width:await page.evaluate(()=>document.documentElement.scrollWidth)},null,2));
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
