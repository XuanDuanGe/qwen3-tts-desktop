export const APP_ROUTE_ITEMS = [
  {
    path: '/',
    label: '首页',
    telemetry: 'home',
    end: true,
  },
  {
    path: '/voice-generate',
    label: '语音生成',
    telemetry: 'voice_generate',
  },
  {
    path: '/voice-clone',
    label: '语音克隆',
    telemetry: 'voice_clone',
  },
  {
    path: '/audio-files',
    label: '音频文件',
    telemetry: 'audio_files',
  },
  {
    path: '/settings',
    label: '设置',
    telemetry: 'settings',
  },
];

export const APP_ROUTE_BY_PATH = Object.fromEntries(
  APP_ROUTE_ITEMS.map(({ path, telemetry }) => [path, telemetry]),
);
