export const CUSTOM_VOICE_MODELS = new Set([
  'qwen3-tts-12hz-1.7b-customvoice',
  'qwen3-tts-12hz-0.6b-customvoice',
]);

export const JOB_STATUS_TEXT = {
  queued: '等待中',
  preparing: '准备中',
  running: '生成中',
  succeeded: '已完成',
  failed: '生成失败',
  cancelled: '已取消',
};
