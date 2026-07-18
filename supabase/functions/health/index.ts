import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(() => new Response(JSON.stringify({ ok: true }), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
}));
