import { NextResponse } from 'next/server';

const API_ORIGIN = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4100';
const ACCESS_TOKEN_COOKIE_NAMES = ['gujalive_access_token', 'gujalive_token'];

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  for (const name of ACCESS_TOKEN_COOKIE_NAMES) {
    const token = cookieValue(request, name);
    if (token) return token;
  }
  return null;
}

export async function forwardShowLoopRequest(
  request: Request,
  context: { params: Promise<{ id: string }> },
  action = '',
) {
  const params = await context.params;
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ success: false, message: 'ต้องเข้าสู่ระบบก่อน' }, { status: 401 });
  }

  const suffix = action ? `/${action}` : '';
  const response = await fetch(
    `${API_ORIGIN}/api/NP/live-channels/${encodeURIComponent(params.id)}/show-loop${suffix}`,
    {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
  );

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
