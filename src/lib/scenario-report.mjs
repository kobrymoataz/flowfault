import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');

/** Create a strict public projection: never serialize the raw page URL or CDP data. */
export function makeScenarioReport(probe) {
  const { scenario, observation } = probe;
  return {
    schemaVersion:'1.0',
    tool:{name:'FlowFault',version:'0.3.0'},
    experiment:{
      page:scenario.publicPageUrl,
      endpoint:scenario.endpoint,
      profile:scenario.profile,
      scope:scenario.scope,
      configuredDelayMs:scenario.delayMs,
      executedAt:new Date().toISOString(),
      mode:'controlled-read-only-get-probe'
    },
    delivery:{ interceptionsApplied:probe.interceptionsApplied,blockedNonReadRequests:probe.blockedNonReadRequests },
    observation:{ kind:observation.kind,status:observation.status,ok:observation.ok,elapsedMs:observation.elapsedMs },
    durationMs:probe.durationMs,
    interpretation:probe.interpretation,
    limitations:[
      'This tests a single GET transport observation, not the application error UI, automatic retry, or end-to-end recovery.',
      'CDP interception covers the inspected page target; it is not a network sandbox.',
      'GET requests may still affect remote services. Use only authorized staging environments.',
      'No form was filled or submitted and no cookies, headers, request bodies, response bodies, field values, or URL queries are saved.'
    ]
  };
}

export function renderScenarioHtml(report) {
  const e=escapeHtml;
  const experiment=report.experiment;
  const observation=report.observation;
  const status=observation.status==null ? 'NETWORK ERROR' : `HTTP ${observation.status}`;
  const annotation=experiment.profile==='offline' ? 'Connection failure' : experiment.profile==='http-503' ? 'Synthetic server response' : 'Delayed origin request';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>FlowFault | Scenario report</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b1016;color:#ecf1f4}
*{box-sizing:border-box}body{margin:0;background:#0b1016;line-height:1.55}.wrap{max-width:1080px;padding:36px 26px 75px;margin:auto}
header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-bottom:22px;border-bottom:1px solid #25303c}
.brand{font-size:21px;font-weight:750;letter-spacing:-.7px}.brand:before{content:'';display:inline-block;width:11px;height:11px;border:3px solid #77d9cd;transform:rotate(45deg);margin-right:18px}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.tiny{font-size:11px;letter-spacing:1.6px;color:#95a9b8;font-weight:700;text-transform:uppercase}
.hero{padding:70px 0 34px}.hero h1{font-size:clamp(34px,7vw,72px);letter-spacing:-.07em;line-height:1.05;margin:14px 0 20px;font-weight:790}
.intro{font-size:15px;color:#a6b6c4;max-width:650px}.target{word-break:break-all;color:#b7e3d9;font-size:13px;padding:12px 0}
.summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0 55px}
.metric{border:1px solid #273541;border-radius:14px;background:#121b24;padding:24px}.metric .value{font-size:32px;font-weight:720;letter-spacing:-.04em;margin-top:10px;word-break:break-word}
.metric .value.small{font-size:20px;letter-spacing:-.03em}.notice{padding:18px 20px;background:#13252a;border-left:3px solid #69ccbc;color:#ddf2ed;margin:28px 0}
h2{font-size:20px;letter-spacing:-.03em;margin:0 0 16px}.split{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}
.panel{padding:26px;border:1px solid #273541;border-radius:14px;background:#111923;min-width:0}.property{display:flex;justify-content:space-between;gap:15px;border-top:1px solid #2a3640;padding:13px 0;font-size:13px}
.property span:first-child{color:#97aab9}.property strong{font-weight:650;overflow-wrap:anywhere;text-align:right}
ul{color:#b4c3cd;font-size:13px;padding-left:19px}li{margin:10px 0}footer{border-top:1px solid #273541;margin-top:50px;padding-top:22px;color:#8295a5;font-size:12px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}
@media(max-width:720px){.wrap{padding:22px 16px 55px}.hero{padding:45px 0 22px}.summary,.split{grid-template-columns:1fr}.metric .value{font-size:25px}}
</style></head><body><main class="wrap">
<header><div class="brand">FlowFault</div><div class="tiny mono">SCENARIO REPORT / ${e(report.tool.version)}</div></header>
<section class="hero"><div class="tiny mono">CONTROLLED NETWORK EXPERIMENT</div><h1>Observe the failure.<br>Understand the boundary.</h1><p class="intro">A deterministic, isolated GET probe with exactly one simulated transport fault. This is not a test of application recovery.</p><div class="target mono">${e(experiment.page)}</div></section>
<section class="summary" aria-label="Key observations">
<div class="metric"><div class="tiny">Profile</div><div class="value small">${e(experiment.profile)}</div></div>
<div class="metric"><div class="tiny">Browser result</div><div class="value small">${e(status)}</div></div>
<div class="metric"><div class="tiny">Observed duration</div><div class="value">${e(observation.elapsedMs)} <span style="font-size:15px;color:#96aab9">ms</span></div></div></section>
<div class="notice"><strong>${e(annotation)}.</strong> ${e(report.interpretation)}</div>
<div class="split"><section class="panel"><h2>Experiment settings</h2>
<div class="property"><span>Requested endpoint</span><strong class="mono">${e(experiment.endpoint)}</strong></div>
<div class="property"><span>Target scope</span><strong>${e(experiment.scope)}</strong></div>
<div class="property"><span>Injected delay</span><strong class="mono">${e(experiment.configuredDelayMs)} ms</strong></div>
<div class="property"><span>Interceptions applied</span><strong>${e(report.delivery.interceptionsApplied)}</strong></div>
<div class="property"><span>Blocked write requests</span><strong>${e(report.delivery.blockedNonReadRequests)}</strong></div>
</section><section class="panel"><h2>Scope and limitations</h2><ul>${report.limitations.map(item=>`<li>${e(item)}</li>`).join('')}</ul></section></div>
<footer><span>FlowFault v${e(report.tool.version)} · Zero embedded analytics</span><span class="mono">${e(experiment.executedAt)}</span></footer>
</main></body></html>`;
}

export async function saveScenarioReports(report, { json, html }) {
  for (const [file, body] of [[json, JSON.stringify(report,null,2)+'\n'], [html, renderScenarioHtml(report)]]) {
    if (!file) continue;
    const path=resolve(file);
    await mkdir(dirname(path),{recursive:true});
    await writeFile(path,body,'utf8');
  }
}
