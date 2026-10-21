import { validateTarget } from './url.mjs';
import { createScenario } from './scenario.mjs';

export const HELP = `FlowFault v0.2.0 | form inspection and controlled GET fault simulation

Usage:
  flowfault inspect <url> [options]
  flowfault simulate <page-url> --endpoint /api/health --profile offline|latency|http-503 [options]
  flowfault compare <baseline.json> <current.json> [--json <file>] [--fail-on none|new-critical|any-new]
  flowfault dashboard [--port 4173]
  flowfault doctor
  flowfault --version

Dashboard:
  --port <integer>        Bind to 127.0.0.1 only (default: 4173, use 0 for auto port)
  Files are read only in the browser, with no server uploads.

Compare options:
  --json <file>           Save sanitized JSON comparison
  --fail-on <level>       none | new-critical | any-new (default: none)

Inspect options:
  --json <file>             Save JSON report
  --html <file>             Save offline HTML report
  --fail-on <level>        none|warning|critical (default: none)

Shared options:
  --timeout <ms>           Browser timeout, 1000-60000 (default: 20000)
  --wait <ms>              DOM settling time, 0-10000 (inspect:400, simulate:300)
  --chrome <path>          Chrome executable override

Simulate options:
  --endpoint <path>        One same-origin GET-only path without query or fragment
  --profile <name>         offline | latency | http-503
  --delay-ms <ms>          100-5000, latency only (default: 800)
  --json <file>            Save sanitized scenario JSON
  --html <file>            Save standalone scenario HTML
  --allow-remote           Opt in to non-loopback targets
  --ack-staging            Confirm authority to test remote HTTPS staging

Safety:
  Simulate defaults to loopback only. Remote requires BOTH consent flags.
  No form submit, no POST/PUT/PATCH/DELETE, no cookies or field values.
  Only one GET is faulted. This is not an end-to-end workflow recovery test.
`;

function integer(value, flag, min, max) {
  if (!/^\d+$/.test(value || '')) throw new Error(`${flag} requires an integer between ${min} and ${max}.`);
  const number = Number(value);
  if (number < min || number > max) throw new Error(`${flag} must be between ${min} and ${max}.`);
  return number;
}

export function parseArgs(argv) {
  if (!argv.length || argv.includes('--help') || argv[0] === 'help') return { command:'help' };
  if (argv[0] === '--version' || argv[0] === '-v') return { command:'version' };
  if (argv[0] === 'doctor') {
    if (argv.length !== 1) throw new Error('doctor takes no arguments.');
    return { command:'doctor' };
  }
  const command = argv[0];
  if (command === 'dashboard') {
    const options = { command, port: 4173 };
    if (argv.length === 1) return options;
    if (argv.length !== 3 || argv[1] !== '--port') throw new Error('dashboard accepts only --port <number>.');
    options.port = integer(argv[2], '--port', 0, 65535);
    return options;
  }
  if (command === 'compare') {
    if (!argv[1] || !argv[2] || argv[1].startsWith('--') || argv[2].startsWith('--')) {
      throw new Error('compare requires two local JSON file paths: baseline and current.');
    }
    const options = { command, baseline: argv[1], current: argv[2], failOn: 'none' };
    const seen = new Set();
    for (let i = 3; i < argv.length; i++) {
      const flag = argv[i];
      if (!['--json','--fail-on'].includes(flag) || seen.has(flag)) throw new Error(`Unknown or repeated compare option: ${flag}`);
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value after ${flag}.`);
      seen.add(flag);
      if (flag === '--json') options.json = value;
      else if (!['none','new-critical','any-new'].includes(value)) throw new Error('--fail-on must be none, new-critical or any-new.');
      else options.failOn = value;
    }
    return options;
  }
  if (command !== 'inspect' && command !== 'simulate') throw new Error(`Unknown command: ${command}`);
  if (!argv[1] || argv[1].startsWith('--')) throw new Error(`${command} requires a page URL.`);
  const result = { command, url:validateTarget(argv[1]), timeout:20000, wait:command === 'inspect' ? 400 : 300 };
  if (command === 'inspect') result.failOn = 'none';
  const pairs = new Map([
    ['--timeout','timeout'],['--wait','wait'],['--chrome','chrome'],
    ...(command === 'inspect' ? [['--json','json'],['--html','html'],['--fail-on','failOn']]
      : [['--endpoint','endpoint'],['--profile','profile'],['--delay-ms','delayMs'],['--json','json'],['--html','html']])
  ]);
  const booleans = command === 'simulate' ? new Map([['--allow-remote','allowRemote'],['--ack-staging','ackStaging']]) : new Map();
  const seen = new Set();
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (booleans.has(flag)) {
      const key = booleans.get(flag);
      if (seen.has(key)) throw new Error(`Option ${flag} is repeated.`);
      result[key] = true;
      seen.add(key);
      continue;
    }
    const key = pairs.get(flag);
    if (!key) throw new Error(`Unknown option: ${flag}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value after ${flag}.`);
    if (seen.has(key)) throw new Error(`Option ${flag} is repeated.`);
    seen.add(key);
    result[key] = value;
    if (key === 'timeout') result[key] = integer(value, flag, 1000, 60000);
    if (key === 'wait') result[key] = integer(value, flag, 0, 10000);
    if (key === 'delayMs') result[key] = integer(value, flag, 100, 5000);
    if (key === 'failOn' && !['none','warning','critical'].includes(value)) {
      throw new Error('--fail-on must be none, warning, or critical.');
    }
  }
  if (command === 'simulate') {
    if (seen.has('delayMs') && result.profile !== 'latency') throw new Error('--delay-ms is only available for the latency profile.');
    if (!result.endpoint || !result.profile) throw new Error('simulate requires --endpoint and --profile.');
    result.scenario = createScenario(result);
  }
  return result;
}
