import type { WebviewMessage } from '../types';

interface VSCodeAPI {
  postMessage(message: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;

class VSCodeWrapper {
  private readonly vscodeApi: VSCodeAPI;

  constructor() {
    this.vscodeApi = acquireVsCodeApi();
  }

  public postMessage(message: WebviewMessage): void {
    this.vscodeApi.postMessage(message);
  }

  public getState<T>(): T | undefined {
    return this.vscodeApi.getState() as T | undefined;
  }

  public setState<T>(state: T): void {
    this.vscodeApi.setState(state);
  }
}

export const vscode = new VSCodeWrapper();
