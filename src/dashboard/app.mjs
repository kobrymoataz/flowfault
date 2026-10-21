import { MAX_REPORT_BYTES, normalizeReport, compareReports, comparisonExport } from '/assets/report-model.mjs';

const $ = id => document.getElementById(id);
const state = { current: null, baseline: null, currentSource: '', baselineSource: '' };
const SEVERITY = ['critical', 'warning', 'info'];

function node(tag, className = '', text = '') {
  const item = document.createElement(tag);
  if (className) item.className = className;
  item.textContent = text;
  return item;
}
function shown(value, fallback = 'Not available') { return value == null || value === '' ? fallback : String(value); }
function dateText(value) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown date';
}
function setError(message = '') {
  const box = $('error');
  box.hidden = !message;
  box.textContent = message;
}
async function readSelectedFile(event, slot) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_REPORT_BYTES) throw new Error('This report is larger than the 2 MB local limit.');
    if (!file.name.toLowerCase().endsWith('.json')) throw new Error('Select a FlowFault .json report.');
    const parsed = JSON.parse(await file.text());
    state[slot] = normalizeReport(parsed);
    state[`${slot}Source`] = file.name.slice(0, 100);
    setError();
    render();
  } catch (error) { setError(`Could not load ${file.name}: ${error.message}`); }
  finally { event.target.value = ''; }
}
async function loadExamples(type = 'inspection') {
  try {
    const urls = type === 'scenario' ? ['/samples/scenario.json'] : ['/samples/baseline.json', '/samples/current.json'];
    const files = await Promise.all(urls.map(async url => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Example file was not available.');
      return normalizeReport(await response.json());
    }));
    if (type === 'scenario') {
      state.current = files[0]; state.baseline = null;
      state.currentSource = 'scenario-example.json'; state.baselineSource = '';
    } else {
      state.baseline = files[0]; state.current = files[1];
      state.currentSource = 'current-example.json'; state.baselineSource = 'baseline-example.json';
    }
    setError(); render();
  } catch (error) { setError(`Examples unavailable: ${error.message}`); }
}
function currentComparison() {
  return state.current && state.baseline ? compareReports(state.baseline, state.current) : null;
}
function sourceCard(slot) {
  const data = state[slot];
  $(slot + '-title').textContent = data ? data.title || data.profile || 'Untitled report' :
    slot === 'current' ? 'No report selected' : 'Optional baseline';
  $(slot + '-meta').textContent = data ? `${data.kind.toUpperCase()}  ·  ${dateText(data.capturedAt)}  ·  ${state[slot+'Source']}${data.sample ? '  ·  EXAMPLE' : ''}` :
    slot === 'current' ? 'Select a JSON inspection or scenario report' : 'Import a previous run to compare';
  $(slot + '-target').textContent = data ? data.target || 'Target not recorded' : 'No local file loaded';
}
function metric(label, value, tone = '') {
  const box = node('article', `metric ${tone}`);
  box.append(node('span', '', label),node('strong','',String(value)));
  return box;
}
function renderMetrics(comparison) {
  const area=$('stat-grid'); area.replaceChildren();
  const current=state.current;
  if (!current) {
    area.append(metric('Loaded reports','0'), metric('Findings','-'),metric('New issues','-'),metric('Resolved','-'));
    return;
  }
  if (current.kind === 'inspection') {
    area.append(
      metric('Current findings',current.metrics.total),
      metric('Critical findings',current.metrics.critical,'critical'),
      metric('New findings',comparison?.compatible ? comparison.counts.added : '-'),
      metric('Resolved findings',comparison?.compatible ? comparison.counts.resolved : '-','positive')
    );
  } else {
    area.append(metric('Fault profile',current.profile),
      metric('HTTP result',current.observation.status == null ? 'Error' : current.observation.status),
      metric('Elapsed time',current.observation.elapsedMs == null ? '-' : `${current.observation.elapsedMs} ms`),
      metric('Interceptions',shown(current.applied, '-')));
  }
}
function renderDistribution() {
  const area=$('distribution'); area.replaceChildren();
  const current=state.current;
  if (!current) {area.append(node('p','empty-copy','Import a report to show severity counts.'));return;}
  if (current.kind !== 'inspection') {area.append(node('p','empty-copy','A scenario is one transport observation, not a set of structural findings. No severity breakdown is available.'));return;}
  const max=Math.max(1,...SEVERITY.map(k=>current.metrics[k]));
  for (const key of SEVERITY) {
    const row=node('div','bar-row');
    const name=node('label','',key);
    const track=node('div','bar-track');
    const fill=node('div',`bar-fill ${key}`);
    fill.style.width=`${current.metrics[key] / max * 100}%`;
    track.append(fill);
    row.append(name,track,node('div','bar-count',String(current.metrics[key])));
    area.append(row);
  }
}
function insight(label, value) {
  const row=node('div','insight-row'); row.append(node('span','',label),node('strong','',String(value)));return row;
}
function renderInsights(comparison) {
  const box=$('insights');box.replaceChildren();
  if (!state.current) {box.append(node('p','empty-copy','Load a current report and an optional baseline to begin.'));return;}
  if (!comparison) {box.append(node('p','empty-copy','No baseline loaded. Import a previous report from the same target to compare changes.'));return;}
  if (!comparison.compatible) {box.append(node('p','empty-copy',comparison.reason));return;}
  if (comparison.kind === 'inspection') {
    box.append(insight('New findings',`+${comparison.counts.added}`), insight('Resolved findings',`-${comparison.counts.resolved}`),
      insight('Persisting',comparison.counts.persisting),insight('New critical',comparison.counts.newCritical));
    box.append(node('p','insight-note','Matching uses finding codes and locations. A change in counts is evidence, not a quality score.'));
  } else {
    box.append(insight('Observed status changed',comparison.statusChanged?'Yes':'No'),
      insight('Duration difference',comparison.deltaMs == null ? '-' : `${comparison.deltaMs > 0 ? '+' : ''}${comparison.deltaMs} ms`));
    box.append(node('p','insight-note','These are two single GET probes. This does not measure application recovery or statistical performance.'));
  }
}
function renderFinding(item, added) {
  const article=node('article','finding');
  const head=node('div','finding-head');
  const name=node('div');name.append(node('div','finding-code',item.code),node('h3','',item.title));
  const markers=node('div'); markers.append(node('span',`severity ${item.severity}`,item.severity));
  if (added) markers.append(node('span','severity','new'));
  head.append(name,markers);article.append(head);
  if (item.detail) article.append(node('p','',item.detail));
  const foot=node('div','finding-foot');
  const recommendation=node('div');
  recommendation.append(node('strong','','RECOMMENDATION '),node('span','',item.recommendation || 'Review the finding.'));
  const where=item.formIndex == null ? 'Page level' : `Form ${item.formIndex+1}${item.fieldIndex == null ? '' : ` / Field ${item.fieldIndex+1}`}`;
  foot.append(recommendation,node('span','',where));article.append(foot);
  return article;
}
function renderFindings(comparison) {
  const area=$('finding-list');area.replaceChildren();
  const current=state.current;
  const filters=$('filters');
  filters.hidden= !current || current.kind !== 'inspection';
  if (!current) {area.append(node('p','empty-copy','No report loaded yet.'));$('finding-count').textContent='NO DATA';return;}
  if (current.kind === 'scenario') {
    $('finding-count').textContent='SINGLE GET PROBE';
    const part=node('article','finding');
    part.append(node('div','finding-code','TRANSPORT OBSERVATION'),node('h3','',`${current.profile} · ${current.endpoint}`),
      node('p','',current.interpretation || 'The browser recorded one isolated transport observation.'),
      node('div','finding-foot',`Result: ${current.observation.kind}${current.observation.status == null ? '' : `, HTTP ${current.observation.status}`}. No form submission or application recovery was tested.`));
    area.append(part);return;
  }
  const query=$('finding-search').value.trim().toLowerCase();
  const severity=$('severity-filter').value;
  const added=new Set(comparison?.compatible && comparison.kind==='inspection' ? comparison.added : []);
  const order={critical:0,warning:1,info:2};
  const results=[...current.issues].filter(i=> (severity==='all' || i.severity===severity) &&
      [i.code,i.title,i.detail,i.recommendation].join(' ').toLowerCase().includes(query))
    .sort((a,b)=>order[a.severity]-order[b.severity] || a.code.localeCompare(b.code));
  $('finding-count').textContent=`${results.length} / ${current.issues.length} FINDINGS`;
  if (!results.length) area.append(node('p','empty-copy','No findings match these filters.'));
  else for(const item of results) area.append(renderFinding(item,added.has(item)));
}
function comparisonColumn(title,items,emptyText) {
  const box=node('section');box.append(node('h3','comparison-title',title));
  if (!items.length) {box.append(node('p','empty-copy',emptyText));return box;}
  const list=node('ul','comparison-list');
  for (const item of items.slice(0,60)) {
    const li=node('li');li.append(node('span','',item.code),node('span','',item.title));list.append(li);
  }
  if (items.length > 60) list.append(node('li','',`Plus ${items.length-60} more. See exported comparison.`));
  box.append(list);return box;
}
function renderComparison(comparison) {
  const box=$('comparison-detail');box.replaceChildren();
  $('export-comparison').disabled=!comparison?.compatible;
  if (!state.current) {box.append(node('p','empty-copy','Nothing to compare yet. Load a report first.'));return;}
  if (!comparison) {box.append(node('p','empty-copy','Import a baseline report to inspect changes between runs.'));return;}
  if (!comparison.compatible) {box.append(node('p','empty-copy',`Comparison blocked: ${comparison.reason}`));return;}
  if (comparison.kind==='scenario') {
    box.append(node('h3','','Scenario observation delta'));
    const statusBefore=comparison.baseline.observation.status;
    const statusAfter=comparison.current.observation.status;
    box.append(insight('Baseline result',statusBefore == null ? comparison.baseline.observation.kind : `HTTP ${statusBefore}`),
      insight('Current result',statusAfter == null ? comparison.current.observation.kind : `HTTP ${statusAfter}`),
      insight('Elapsed delta',comparison.deltaMs == null ? 'Not available' : `${comparison.deltaMs} ms`),
      node('p','insight-note','Different transport outcomes are observations only. This is not a pass/fail recovery assessment.'));
    return;
  }
  const columns=node('div','comparison-grid');
  columns.append(comparisonColumn('New in current',comparison.added,'No new findings.'),
    comparisonColumn('Resolved since baseline',comparison.resolved,'No resolved findings.'));
  box.append(columns);
  if (comparison.severityChanged.length) box.append(node('p','insight-note',`${comparison.severityChanged.length} persisting finding(s) changed severity.`));
}
function render() {
  sourceCard('current');sourceCard('baseline');
  const current=state.current;
  const comparison=currentComparison();
  const anyExample=Boolean(current?.sample || state.baseline?.sample);
  const label=$('sample-banner');label.classList.toggle('with-private',!anyExample);
  $('sample-message').textContent=anyExample ?
    'Example report loaded. Numbers are demonstration data, not results from your websites.' :
    'Local report mode. JSON files are processed in memory and never uploaded.';
  $('report-type').textContent=current ? current.kind.toUpperCase() : 'NO REPORT';
  renderMetrics(comparison);renderDistribution();renderInsights(comparison);renderFindings(comparison);renderComparison(comparison);
}
function exportJson() {
  const comparison=currentComparison();
  if (!comparison?.compatible) return;
  const serialized=JSON.stringify(comparisonExport(comparison),null,2)+'\n';
  const blob=new Blob([serialized],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const anchor=node('a');anchor.href=url;anchor.download='flowfault-comparison.json';
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('current-file').addEventListener('change',e=>readSelectedFile(e,'current'));
$('baseline-file').addEventListener('change',e=>readSelectedFile(e,'baseline'));
$('finding-search').addEventListener('input',()=>renderFindings(currentComparison()));
$('severity-filter').addEventListener('change',()=>renderFindings(currentComparison()));
$('export-comparison').addEventListener('click',exportJson);
$('reset-examples').addEventListener('click',()=>loadExamples());
$('example-scan').addEventListener('click',()=>loadExamples());
$('example-scenario').addEventListener('click',()=>loadExamples('scenario'));
$('clear-all').addEventListener('click',()=>{
  state.current=null;state.baseline=null;state.currentSource='';state.baselineSource='';
  $('finding-search').value='';$('severity-filter').value='all';setError();render();
});
render();
loadExamples();
