// src/arena/format.js
const vndFormat = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const toSafeNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

export function formatVnd(amount) {
  return vndFormat.format(toSafeNumber(amount));
}

export function formatCountdown(ms) {
  const totalSeconds = Math.ceil(toSafeNumber(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}
