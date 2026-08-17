import { invoke } from '@tauri-apps/api/core';

export const greet = (name) => invoke('greet', { name });
