import type { Env } from '../_types';
import { json } from '../_lib';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  return json({
    ok: true,
    env: ctx.env.ENVIRONMENT ?? 'production',
    time: new Date().toISOString(),
  });
};
