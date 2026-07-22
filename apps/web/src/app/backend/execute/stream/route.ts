const API_ORIGIN = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const body = await request.text();

  const response = await fetch(`${API_ORIGIN}/execute/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body,
    signal: request.signal,
  });

  if (!response.ok || !response.body) {
    const error = await response.text();
    return new Response(error || "Stream request failed", {
      status: response.status,
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
