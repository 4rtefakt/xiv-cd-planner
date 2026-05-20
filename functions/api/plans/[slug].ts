import type { Env } from '../../_types';
import { isValidSlug, json, jsonErr } from '../../_lib';

function getStub(env: Env, slug: string) {
  const id = env.PLAN_DO.idFromName(slug);
  return env.PLAN_DO.get(id);
}

async function forward(env: Env, slug: string, init: RequestInit): Promise<Response> {
  const stub = getStub(env, slug);
  return stub.fetch('https://do/', init);
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const slug = String(ctx.params.slug ?? '');
  if (!isValidSlug(slug)) return jsonErr(400, 'bad_slug', 'malformed slug');

  const res = await forward(ctx.env, slug, { method: 'GET' });
  // pass DO response straight back, including 404s
  return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  const slug = String(ctx.params.slug ?? '');
  if (!isValidSlug(slug)) return jsonErr(400, 'bad_slug', 'malformed slug');

  const body = await ctx.request.text();
  const res = await forward(ctx.env, slug, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body,
  });
  return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const slug = String(ctx.params.slug ?? '');
  if (!isValidSlug(slug)) return jsonErr(400, 'bad_slug', 'malformed slug');

  const res = await forward(ctx.env, slug, { method: 'DELETE' });
  return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json' } });
};

export const onRequest: PagesFunction<Env> = async () => {
  return json({ error: 'method_not_allowed' }, 405);
};
