import { validateTarget } from './url.mjs';

export const HELP = `FlowFault v0.1.0 | read-only form reliability inspector

Usage:
  flowfault inspect <url> [options]
  flowfault doctor
  flowfault --version

Options for inspect:
  --json <file>           Save machine-readable JSON report
  --html <file>           Save standalone HTML report
  --timeout <ms>         Navigation timeout, 1000-60000 (default: 20000)
  --wait <ms>            Extra DOM settling time, 0-10000 (default: 400)
  --fail-on <level>      Exit 2 on warning or critical findings (default: none)
  --chrome <path>        Chrome executable override
  --help                 Show this help

Safety:
  Only GET/HEAD browser requests are allowed. FlowFault does not fill,
  click, or submit forms. Use only on sites you own or may inspect.
  Query strings, passwords, cookies and field values are never stored.
`;

function integer(value, flag, min, max) {
  if (!/^\d+$/.test(value || '')) throw new Error(`${flag} requires an integer between ${min} and ${max}.`);
  const result = Number(value);
  if (result < min || result > max) throw new Error(`${flag} must be between ${min} and ${max}.`);
  return result;
}

export function parseArgs(argv) {
  if (!argv.length || argv.includes('--help') || argv[0] === 'help') return { command: 'help' };
  if (argv[0] === '--version' || argv[0] === '-v') return { command: 'version' };
  if (argv[0] === 'doctor') {
    if (argv.length !== 1) throw new Error('doctor takes no arguments.');
    return { command: 'doctor' };
  }
  if (argv[0] !== 'inspect') throw new Error(`Unknown command: ${argv[0]}`);
  if (!argv[1] || argv[1].startsWith('--')) throw new Error('inspect requires a URL.');
  const options = { command: 'inspect', url: validateTarget(argv[1]), timeout: 20000, wait: 400, failOn: 'none' };
  const flags = new Map([['--json', 'json'], ['--html', 'html'], ['--timeout', 'timeout'], ['--wait', 'wait'], ['--fail-on', 'failOn'], ['--chrome', 'chrome']]);
  const seen = new Set();
  for (let i = 2; i < argv.length; i += 2) {
    const name = flags.get(argv[i]);
    if (!name) throw new Error(`Unknown option: ${argv[i]}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value after ${argv[i]}.`);
    if (seen.has(name)) throw new Error(`Option ${argv[i]} is repeated.`);
    seen.add(name);
    options[name] = value;
    if (name === 'timeout') options[name] = integer(value, '--timeout', 1000, 60000);
    if (name === 'wait') options[name] = integer(value, '--wait', 0, 10000);
    if (name === 'failOn' && !['none', 'warning', 'critical'].includes(value)) {
      throw new Error('--fail-on must be none, warning, or critical.');
    }
  }
  return options;
}
