import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { MAX_REPORT_BYTES, normalizeReport, compareReports, comparisonExport } from './report-model.mjs';

/** Loading files is explicit. We neither scan directories nor contact networks. */
export async function loadReportFile(filename) {
  const path = resolve(filename);
  const metadata = await stat(path);
  if (!metadata.isFile() || metadata.size > MAX_REPORT_BYTES) {
    throw new Error(`Report must be a JSON file smaller than ${MAX_REPORT_BYTES} bytes.`);
  }
  const buffer = await readFile(path);
  if (buffer.byteLength > MAX_REPORT_BYTES) throw new Error('Report exceeds the maximum supported size.');
  let source;
  try { source = JSON.parse(buffer.toString('utf8')); }
  catch { throw new Error(`Cannot parse JSON report: ${path}`); }
  return normalizeReport(source);
}

export async function compareReportFiles(options) {
  const [before, after] = await Promise.all([
    loadReportFile(options.baseline), loadReportFile(options.current)
  ]);
  const comparison = compareReports(before, after);
  if (!comparison.compatible) throw new Error(comparison.reason);
  if (options.json) {
    const dest = resolve(options.json);
    if ([options.baseline, options.current].some(path => resolve(path) === dest)) {
      throw new Error('Comparison output cannot overwrite an input report.');
    }
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, JSON.stringify(comparisonExport(comparison), null, 2) + '\n', 'utf8');
  }
  return comparison;
}

export function shouldFailComparison(comparison, level = 'none') {
  if (comparison.kind !== 'inspection') return false;
  if (level === 'any-new') return comparison.counts.added > 0;
  if (level === 'new-critical') return comparison.counts.newCritical > 0;
  return false;
}
