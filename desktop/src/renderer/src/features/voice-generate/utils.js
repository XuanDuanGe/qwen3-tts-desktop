export function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value?.type === 'Buffer' && Array.isArray(value.data)) {
    return new Uint8Array(value.data);
  }
  return new Uint8Array(value);
}
