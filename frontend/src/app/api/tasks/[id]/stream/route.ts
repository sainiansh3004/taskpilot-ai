import { readTask, readTaskEvents } from '../../../../../lib/serverlessAgent';

export const maxDuration = 300;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let cursor = 0;

      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      req.signal.addEventListener('abort', close, { once: true });

      void (async () => {
        try {
          while (!closed) {
            const events = await readTaskEvents(id);
            for (; cursor < events.length; cursor++) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(events[cursor])}\n\n`));
            }

            const task = await readTask(id);
            if (task && ['succeeded', 'partially_succeeded', 'failed', 'cancelled', 'budget_exhausted'].includes(task.status)) {
              close();
              return;
            }

            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Task event stream failed for ${id}:`, error);
          if (!closed) {
            closed = true;
            controller.error(error);
          }
        }
      })();
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
