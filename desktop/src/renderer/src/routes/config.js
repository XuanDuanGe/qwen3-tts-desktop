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
    path: '/settings',
    label: '设置',
    telemetry: 'settings',
  },
];

export const APP_ROUTE_BY_PATH = Object.fromEntries(
  APP_ROUTE_ITEMS.map(({ path, telemetry }) => [path, telemetry]),
);
