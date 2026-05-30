import type { PuffinAPI } from '../shared/types';

declare global {
  interface Window {
    puffin: PuffinAPI;
  }
}

export {};
