import type * as Party from 'partykit/server';
import { onConnect } from 'y-partykit';

// One PartyKit "room" per sheet id. y-partykit handles the Yjs sync protocol
// and persists the doc into Durable Object storage automatically.
export default class SheetServer implements Party.Server {
  constructor(public party: Party.Party) {}

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    return onConnect(conn, this.party, {
      persist: { mode: 'snapshot' },
    });
  }

  // Allow the Vercel cron / API to hard-delete an expired sheet's doc.
  async onRequest(req: Party.Request) {
    if (req.method === 'DELETE') {
      const auth = req.headers.get('authorization');
      if (auth !== `Bearer ${this.party.env.ADMIN_TOKEN}`) {
        return new Response('forbidden', { status: 403 });
      }
      await this.party.storage.deleteAll();
      return new Response('ok');
    }
    return new Response('method not allowed', { status: 405 });
  }
}
