export function isSellPutMarketWindow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hourCycle: 'h23',
    weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find(part => part.type === type)?.value || '';
  const weekday = get('weekday');
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return minutes >= 9 * 60 + 30 && minutes <= 16 * 60 + 15;
}
