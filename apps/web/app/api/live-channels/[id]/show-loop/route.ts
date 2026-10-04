import { forwardShowLoopRequest } from './proxy';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return forwardShowLoopRequest(request, context);
}
