import { invoke } from '@tauri-apps/api/core';

export function greet(name) {
  return invoke('greet', { name });
}
