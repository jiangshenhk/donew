// ntfy.mjs — ntfy 通知客户端（可配置差异）
// 通过依赖注入保留三个机器人现有行为差异
//
// 超时契约：本模块不自行实现 AbortController 超时。
// 当配置 timeoutMs 时，会把 timeoutMs 作为第三参数传给注入的 request，
// 由调用方注入的 request（如 fetchWithTimeout）负责超时实现。
// 原生 fetch 不接受第三参数，因此必须注入自定义 request 才能使用 timeoutMs。

export function createNtfyClient({
  server,
  topic,
  token,
  request = fetch,
  timeoutMs = null,
  titleMode = 'ascii-header', // 'ascii-header' | 'query'
  requireOk = true,
  onSuccess = null,
  onError = null,
}) {
  return {
    async send(title, message, tags = '') {
      try {
        const url = new URL(`${server}/${topic}`);
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Priority': '4',
          'Markdown': 'yes',
        };
        if (tags) headers['Tags'] = tags;

        let body = message;
        if (titleMode === 'ascii-header') {
          headers['Title'] = String(title).replace(/[^\x00-\x7F]/g, '').trim() || 'donew';
        } else if (titleMode === 'query') {
          url.searchParams.set('title', title);
        }

        const options = { method: 'POST', headers, body };
        const res = timeoutMs
          ? await request(url, options, timeoutMs)
          : await request(url, options);

        if (requireOk && !res.ok) throw new Error(`ntfy ${res.status}`);
        if (onSuccess) onSuccess(title);
        return { ok: true, status: res.status };
      } catch (error) {
        if (onError) onError(error);
        return { ok: false, error: error.message };
      }
    },
  };
}
