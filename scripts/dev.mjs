import { spawn } from 'node:child_process';

const commands = [
  ['backend', ['run', 'dev', '--workspace', 'backend']],
  ['frontend', ['run', 'dev', '--workspace', 'frontend']],
];

const children = commands.map(([name, args]) => {
  const child = spawn('npm', args, {
    shell: true,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${name} stopped with signal ${signal}`);
      return;
    }

    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exitCode = code;
      stopAll();
    }
  });

  return child;
});

function stopAll() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(143);
});
