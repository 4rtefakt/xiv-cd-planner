export { PlanDO } from './plan-do';

// Stub fetch handler — the Worker isn't called directly except via DO
// cross-script binding from Pages Functions. Return 404 to anyone who
// pokes the worker URL by mistake.
export default {
  async fetch(): Promise<Response> {
    return new Response('cooldown-planner-do hosts PlanDO via cross-script binding only.', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    });
  },
};
