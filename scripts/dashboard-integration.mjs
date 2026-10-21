import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { startDashboard } from '../src/lib/dashboard-server.mjs';
import { launchChrome } from '../src/lib/chrome.mjs';

const app = await startDashboard({ port: 0 });
let chrome;
try {
  chrome = await launchChrome({});
  const cdp = chrome.cdp;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1536, height: 1100, deviceScaleFactor: 1, mobile: false
  });
  const navigation = await cdp.send('Page.navigate', { url: app.url });
  assert.ok(!navigation.errorText, `Dashboard navigation failed: ${navigation.errorText}`);
  const evalJs = async expression => {
    const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.text);
    return res.result?.value;
  };
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (await evalJs("document.getElementById('current-title')?.textContent.includes('updated') && document.getElementById('stat-grid')?.textContent.includes('New findings')")) {
      ready = true; break;
    }
    await new Promise(r => setTimeout(r, 150));
  }
  assert.equal(ready, true, 'Dashboard did not load example JSON and update the DOM');
  const original = await evalJs("document.getElementById('comparison-detail').textContent");
  assert.match(original, /Resolved since baseline/);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  if (process.env.FLOWFAULT_DASHBOARD_SCREENSHOT) {
    await writeFile(process.env.FLOWFAULT_DASHBOARD_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
  }
  await evalJs(`(async()=>{
    document.getElementById('severity-filter').value='critical';
    document.getElementById('severity-filter').dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
  const filtered = await evalJs("document.getElementById('finding-count').textContent");
  assert.match(filtered, /2 \/ 3/);
  await evalJs("document.getElementById('example-scenario').click();true");
  let scenarioLoaded = false;
  for (let i=0;i<30;i++) {
    if(await evalJs("document.getElementById('report-type').textContent === 'SCENARIO'")) {scenarioLoaded=true;break;}
    await new Promise(r=>setTimeout(r,120));
  }
  assert.equal(scenarioLoaded,true);
  assert.equal(await evalJs("document.getElementById('export-comparison').disabled"),true);
  await evalJs("document.getElementById('clear-all').click();true");
  assert.equal(await evalJs("document.getElementById('report-type').textContent"),'NO REPORT');
  console.log('Dashboard Chromium integration passed: example imports, comparison, filters, scenario, clear state.');
} finally {
  await chrome?.close();
  await app.close();
}
