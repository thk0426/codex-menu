const API_ORIGIN = 'https://codex-menu.thk20010426.workers.dev';

export async function onRequest({ request }) {
  const incoming = new URL(request.url);
  const upstream = new URL(`${incoming.pathname}${incoming.search}`, API_ORIGIN);
  try {
    return await fetch(new Request(upstream, request));
  } catch (error) {
    console.error('Pages API proxy failed', error);
    return Response.json({ error: '点菜服务暂时不可用，请稍后重试' }, { status: 502 });
  }
}
