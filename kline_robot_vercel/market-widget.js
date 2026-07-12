// Donew Market Price Widget
// Usage:
// <script src="/market-widget.js"></script>
// <div id="market-widget"></div>

(function () {
  async function loadMarketWidget() {
    const box = document.getElementById('market-widget');
    if (!box) return;

    try {
      const res = await fetch('/api/latest-price', {
        cache: 'no-store'
      });
      const json = await res.json();

      if (!json.ok) throw new Error(json.error || '行情获取失败');

      const items = json.data || {};
      const watch = [
        ['QQQ', '纳指ETF'],
        ['SPY', '标普ETF'],
        ['^VIX', 'VIX'],
        ['BTC-USD', 'BTC'],
        ['^TNX', '10Y'],
        ['GC=F', '黄金']
      ];

      box.innerHTML = `
        <div class="market-widget">
          ${watch.map(([symbol, name]) => {
            const item = items[symbol];
            if (!item) return '';
            const change = item.changePercent == null
              ? ''
              : `${item.changePercent > 0 ? '+' : ''}${item.changePercent.toFixed(2)}%`;
            return `
              <div class="market-item">
                <span>${name}</span>
                <b>${item.price ?? '-'}</b>
                <small>${change}</small>
              </div>`;
          }).join('')}
        </div>
        <div class="market-time">
          更新时间：${json.updatedAt || '-'}
        </div>
      `;
    } catch (e) {
      box.innerHTML = `<div class="market-error">行情暂时不可用</div>`;
    }
  }

  window.loadMarketWidget = loadMarketWidget;
  document.addEventListener('DOMContentLoaded', loadMarketWidget);
})();
