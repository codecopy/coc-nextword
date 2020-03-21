import { ChildProcess, spawn } from 'child_process';
import { CompleteResult, VimCompleteItem, workspace, WorkspaceConfiguration } from 'coc.nvim';
import { existsSync } from 'fs';
import which from 'which';

class Config {
  private cfg: WorkspaceConfiguration;

  constructor() {
    this.cfg = workspace.getConfiguration('nextword');
  }

  get enabled() {
    return this.cfg.get('enabled', true);
  }

  get dataPath() {
    const dataPath = this.cfg.get('dataPath', '');
    return dataPath ? dataPath : process.env.NEXTWORD_DATA_PATH;
  }

  get count() {
    return this.cfg.get('count') as string;
  }
}

export class Ctx {
  public readonly config: Config;
  private proc: ChildProcess | null = null;

  constructor() {
    this.config = new Config();
  }

  get bin(): string | undefined {
    const bin = which.sync('nextword', { nothrow: true });
    if (!bin) return;

    if (!existsSync(bin)) return;

    return bin;
  }

  async nextwords(): Promise<CompleteResult | undefined> {
    if (!this.proc) {
      let args: string[] = ['-c', this.config.count];
      if (this.config.dataPath) {
        args = args.concat(['-d', this.config.dataPath]);
      }
      this.proc = spawn(this.bin!, args);
    }

    if (!this.proc) return;

    const line = await workspace.nvim.line;
    // TODO: use whole line as input?
    // should cleanup the line
    // const parts = line.split(' ');
    // const last = parts[parts.length - 2];
    this.proc.stdin?.write(line + ' \n');

    return new Promise<CompleteResult>(resolve => {
      const items: VimCompleteItem[] = [];
      this.proc?.stdout?.on('data', chunk => {
        for (const word of (chunk.toString() as string).split(' ')) {
          items.push({ word: word.trimRight() });
        }

        resolve({ items });
      });

      this.proc?.on('error', () => {
        resolve();
      });
    });
  }
}