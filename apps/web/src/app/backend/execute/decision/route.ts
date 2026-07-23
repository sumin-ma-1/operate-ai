const API_ORIGIN = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const body = await request.text();

  const response = await fetch(`${API_ORIGIN}/execute/decision`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    signal: request.signal,
  });

  if (!response.ok) {
    const error = await response.text();
    return new Response(error || "Decision request failed", {
      status: response.status,
    });
  }

  const data = await response.text();
  return new Response(data, {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
