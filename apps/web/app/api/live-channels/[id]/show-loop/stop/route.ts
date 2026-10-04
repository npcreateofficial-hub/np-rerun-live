import { forwardShowLoopRequest } from '../proxy';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return forwardShowLoopRequest(request, context, 'stop');
}
