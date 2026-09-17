export async function onRequest({ request, env }) {
  try {
    if (!env.API) return Response.json({ error: 'Pages 尚未绑定点菜服务' }, { status: 503 });
    return await env.API.fetch(request);
  } catch (error) {
    console.error('Pages API proxy failed', error);
    return Response.json({ error: '点菜服务暂时不可用，请稍后重试' }, { status: 502 });
  }
}
