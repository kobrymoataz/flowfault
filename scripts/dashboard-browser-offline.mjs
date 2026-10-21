import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { launchChrome } from '../src/lib/chrome.mjs';

// Browser UI smoke test without localhost navigation. It injects the exact
// checked-in HTML, styles, model and app source into Chrome's about:blank page;
// only the three sample JSON fetches are stubbed from checked-in fixtures.
const root = new URL('../src/dashboard/', import.meta.url);
const [html, css, appCode, modelCode, baseline, current, scenario] = await Promise.all([
  readFile(new URL('index.html',root),'utf8'),
  readFile(new URL('site.css',root),'utf8'),
  readFile(new URL('app.mjs',root),'utf8'),
  readFile(new URL('../lib/report-model.mjs',root),'utf8'),
  readFile(new URL('samples/baseline.json',root),'utf8'),
  readFile(new URL('samples/current.json',root),'utf8'),
  readFile(new URL('samples/scenario.json',root),'utf8')
]);
let chrome;
try {
  chrome=await launchChrome({});
  const cdp=chrome.cdp;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1536,height:1100,deviceScaleFactor:1,mobile:false});
  const frame = await cdp.send('Page.getFrameTree');
  await cdp.send('Page.setDocumentContent',{frameId:frame.frameTree.frame.id,html});
  const invoke=async expression=>{
    const result=await cdp.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0,500));
    return result.result?.value;
  };
  await invoke(`(()=>{const style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style);return true;})()`);
  const fixtures={
    '/samples/baseline.json': JSON.parse(baseline),
    '/samples/current.json': JSON.parse(current),
    '/samples/scenario.json': JSON.parse(scenario)
  };
  const compiled=`(()=>{
    const fixtures=${JSON.stringify(fixtures)};
    globalThis.fetch=async path=>({ok:Object.hasOwn(fixtures,path),json:async()=>fixtures[path]});
    ${modelCode.replaceAll('export ','')}
    ${appCode.replace(/^import[^\n]+\n/,'')}
    return true;
  })()`;
  assert.equal(await invoke(compiled),true);
  let loaded=false;
  for(let i=0;i<40;i++){
    if(await invoke("document.getElementById('current-title')?.textContent.includes('updated')")) {loaded=true;break;}
    await new Promise(r=>setTimeout(r,70));
  }
  assert.equal(loaded,true,'Example reports should populate UI');
  assert.equal(await invoke("document.getElementById('stat-grid').textContent.includes('New findings')"),true);
  assert.match(await invoke("document.getElementById('comparison-detail').textContent"),/Resolved since baseline/);
  if(process.env.FLOWFAULT_DASHBOARD_SCREENSHOT) {
    const screenshot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(process.env.FLOWFAULT_DASHBOARD_SCREENSHOT,Buffer.from(screenshot.data,'base64'));
  }
  await invoke("document.getElementById('severity-filter').value='critical';document.getElementById('severity-filter').dispatchEvent(new Event('change',{bubbles:true}));true");
  assert.match(await invoke("document.getElementById('finding-count').textContent"),/2 \/ 3/);
  await invoke("document.getElementById('example-scenario').click();true");
  for(let i=0;i<40;i++){
    if(await invoke("document.getElementById('report-type').textContent==='SCENARIO'"))break;
    await new Promise(r=>setTimeout(r,70));
  }
  assert.equal(await invoke("document.getElementById('report-type').textContent"),'SCENARIO');
  assert.equal(await invoke("document.getElementById('export-comparison').disabled"),true);
  await invoke("document.getElementById('clear-all').click();true");
  assert.equal(await invoke("document.getElementById('report-type').textContent"),'NO REPORT');
  console.log('Offline Chrome dashboard passed: samples, delta, filtering, scenario and empty state.');
}finally{await chrome?.close();}
