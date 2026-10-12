import { getTaskEvents, subscribeTaskEvents } from '../../../../../lib/serverlessAgent';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send all existing events first
      const existing = getTaskEvents(id);
      for (const evt of existing) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
      }

      // 2. Subscribe to subsequent live events
      const unsubscribe = subscribeTaskEvents(id, (evt) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
          if (['task_completed', 'cancelled', 'budget_exhausted'].includes(evt.eventType)) {
            // Keep stream open briefly then close
            setTimeout(() => {
              try { controller.close(); } catch {}
            }, 1000);
          }
        } catch {
          unsubscribe();
        }
      });

      req.signal.addEventListener('abort', () => {
        unsubscribe();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}
