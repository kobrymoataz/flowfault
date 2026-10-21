import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export function makeReport(snapshot, analysis) {
  return {
    schemaVersion: '1.0',
    tool: { name: 'FlowFault', version: '0.1.0' },
    scan: {
      url: snapshot.url,
      title: snapshot.title,
      scannedAt: new Date().toISOString(),
      durationMs: snapshot.durationMs,
      blockedNonReadRequests: snapshot.blockedRequests,
      mode: 'read-only',
      truncated: snapshot.truncated
    },
    summary: analysis.summary,
    forms: snapshot.forms,
    issues: analysis.issues
  };
}

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function renderHtml(report) {
  const e = escapeHtml;
  const safeClass = severity => ['critical', 'warning', 'info'].includes(severity) ? severity : 'info';
  const counts = report.summary;
  const forms = report.forms.map(form => `
    <article class="form-card">
      <div class="form-top"><div><span class="mono eyebrow">FORM ${String(form.index + 1).padStart(2, '0')}</span>
      <h3>${e(form.id || `Form ${form.index + 1}`)}</h3></div>
      <span class="method">${e(form.method.toUpperCase())}</span></div>
      <p class="action mono">${e(form.action)}</p>
      <div class="form-details"><span>${form.fields.length} fields</span><span>${form.submitControls} submit controls</span></div>
    </article>`).join('');
  const issues = report.issues.length ? report.issues.map((item, index) => `
    <article class="issue">
      <div class="issue-top"><div><span class="mono issue-code">${e(item.code)} / ${String(index + 1).padStart(2, '0')}</span>
      <h3>${e(item.title)}</h3></div><span class="pill ${safeClass(item.severity)}">${e(item.severity)}</span></div>
      <p>${e(item.detail)}</p><div class="fix"><strong>RECOMMENDATION</strong><span>${e(item.recommendation)}</span></div>
      ${Number.isInteger(item.formIndex) ? `<div class="location mono">Form ${item.formIndex + 1}${Number.isInteger(item.fieldIndex) ? ` · Field ${item.fieldIndex + 1}` : ''}</div>` : ''}
    </article>`).join('') : '<div class="empty">No findings from the rules available in v0.1.0. This is not a compliance certification.</div>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>FlowFault | Inspection report</title>
<style>
:root{color-scheme:dark;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55;background:#090f17;color:#e6edf6}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 84% 2%,#18334c 0,transparent 36%),#090f17;min-height:100vh}
.container{max-width:1120px;margin:0 auto;padding:38px 26px 70px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.topbar{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #233243;padding-bottom:24px;gap:12px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:750;letter-spacing:-.8px}.mark{width:34px;height:34px;border:1px solid #3cbfb8;border-radius:10px;display:grid;place-items:center;color:#7ae9dc;background:#0c363c}
.version,.eyebrow,.issue-code{font-size:11px;letter-spacing:1.7px;color:#83a2bd;font-weight:700;text-transform:uppercase}
.hero{padding:68px 0 36px}.hero h1{font-size:clamp(38px,7vw,74px);letter-spacing:-3.5px;line-height:1.03;margin:14px 0 24px}.hero p{color:#9eb4cb;max-width:730px;font-size:16px}
.target{display:inline-block;max-width:100%;word-break:break-all;border:1px solid #294354;border-radius:10px;padding:10px 15px;color:#9ce3df;background:#0e222b;font-size:13px}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:18px 0 56px}.stat{background:#111c29;border:1px solid #233345;padding:23px;border-radius:16px}
.stat .label{font-size:12px;color:#9ab0c4;text-transform:uppercase;letter-spacing:1px}.stat .number{font-size:37px;font-weight:750;letter-spacing:-2px;margin-top:10px}
.section-head{display:flex;justify-content:space-between;align-items:baseline;gap:15px;border-bottom:1px solid #223242;padding-bottom:13px;margin:40px 0 20px}.section-head h2{font-size:21px;letter-spacing:-.6px;margin:0}.section-head span{font-size:12px;color:#819aaf}
.issue,.form-card{background:#111b27;border:1px solid #253343;border-radius:14px;padding:24px;margin-bottom:13px}.issue-top,.form-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
h3{font-size:17px;letter-spacing:-.4px;margin:5px 0}.issue p{color:#bac9d8;font-size:14px;margin:12px 0 15px}.pill{font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:750;border-radius:50px;padding:5px 10px;border:1px solid}
.pill.critical{background:#3b1e29;color:#ffa3b3;border-color:#663343}.pill.warning{background:#45371f;color:#fbd18a;border-color:#6b542b}.pill.info{background:#153145;color:#a7d8f7;border-color:#245571}
.fix{display:grid;grid-template-columns:150px 1fr;gap:16px;border-radius:9px;padding:13px 14px;background:#0b1520;color:#d1e1ed;font-size:13px}
.fix strong{color:#75b8bb;font-size:10px;letter-spacing:1px;margin-top:2px}.location{font-size:11px;color:#7290a9;margin-top:12px}.method{border:1px solid #315b6d;color:#84e4d8;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:800}.action{color:#8fa6bb;font-size:12px;overflow-wrap:anywhere;margin:8px 0 15px}.form-details{display:flex;gap:20px;color:#b2c3d4;font-size:12px}.empty{border:1px dashed #365068;border-radius:14px;padding:34px;color:#9cb6c9}.footer{border-top:1px solid #253749;margin-top:52px;padding-top:22px;color:#7791a7;font-size:12px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media(max-width:670px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.fix{grid-template-columns:1fr;gap:4px}.container{padding:22px 16px}.hero{padding:45px 0 30px}.hero h1{letter-spacing:-2px}.stat{padding:17px}.stat .number{font-size:29px}}
</style>
</head>
<body><main class="container">
<header class="topbar"><div class="brand"><span class="mark" aria-hidden="true">◆</span> FlowFault</div><span class="version mono">INSPECTION / ${e(report.tool.version)}</span></header>
<section class="hero"><span class="eyebrow mono">WORKFLOW HEALTH / READ-ONLY</span><h1>Inspection report<span style="color:#73d5cd">.</span></h1>
<div class="target mono">${e(report.scan.url)}</div><p>A focused snapshot of HTML forms, structural accessibility signals and potentially unsafe submission configurations.</p></section>
<section class="stats" aria-label="Inspection statistics">
<div class="stat"><div class="label">Forms</div><div class="number">${counts.forms}</div></div>
<div class="stat"><div class="label">Fields</div><div class="number">${counts.fields}</div></div>
<div class="stat"><div class="label">Critical</div><div class="number">${counts.critical}</div></div>
<div class="stat"><div class="label">Warnings</div><div class="number">${counts.warning}</div></div></section>
<section aria-labelledby="findings"><div class="section-head"><h2 id="findings">Findings</h2><span>${counts.issues} total / ${counts.info} informational</span></div>${issues}</section>
<section aria-labelledby="forms"><div class="section-head"><h2 id="forms">Form inventory</h2><span>${counts.analyzedForms} inspected</span></div>${forms || '<div class="empty">No forms found.</div>'}</section>
<footer class="footer"><span>FlowFault v${e(report.tool.version)} · Local report, no tracking scripts</span><span>${e(report.scan.scannedAt)} · ${Number(report.scan.durationMs) || 0} ms · ${Number(report.scan.blockedNonReadRequests) || 0} blocked non-read requests</span></footer>
</main></body></html>`;
}

export async function saveReports(report, { json, html }) {
  for (const [file, content] of [
    [json, JSON.stringify(report, null, 2) + '\n'],
    [html, renderHtml(report)]
  ]) {
    if (!file) continue;
    const path = resolve(file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }
}
