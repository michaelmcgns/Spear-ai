// Edge runtime streams the request body directly to AssemblyAI's upload
// endpoint without buffering. This bypasses both Vercel's 4.5 MB serverless
// limit AND Supabase Storage's free-tier per-file size cap.
export const runtime = "edge";

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);

export async function POST(req: Request): Promise<Response> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "AssemblyAI key not configured" }, { status: 500 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    return Response.json({ error: `Call recordings can be up to ${MAX_UPLOAD_MB} MB.` }, { status: 413 });
  }

  if (!req.body) {
    return Response.json({ error: "No audio stream provided" }, { status: 400 });
  }

  // Authenticate via the Supabase bearer token that the browser sends
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnon) {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { "Authorization": authHeader, "apikey": supabaseAnon },
    });
    if (!userRes.ok) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Pipe the request body stream directly to AssemblyAI — never buffered
  try {
    const contentType = req.headers.get("content-type") || "application/octet-stream";
    const headers: Record<string, string> = {
      "Authorization": apiKey,
      "Content-Type":  contentType,
    };
    const cl = req.headers.get("content-length");
    if (cl) headers["Content-Length"] = cl;

    let uploadedBytes = 0;
    const sizeGuard = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        uploadedBytes += chunk.byteLength;
        if (uploadedBytes > MAX_UPLOAD_BYTES) {
          controller.error(new Error(`Call recordings can be up to ${MAX_UPLOAD_MB} MB.`));
          return;
        }
        controller.enqueue(chunk);
      },
    });

    const aaiRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method:  "POST",
      headers,
      body:    req.body.pipeThrough(sizeGuard),
      duplex:  "half",
    } as RequestInit & { duplex: "half" });

    if (!aaiRes.ok) {
      const err = await aaiRes.text();
      return Response.json(
        { error: `AssemblyAI upload failed (${aaiRes.status}): ${err}` },
        { status: aaiRes.status }
      );
    }

    const { upload_url } = await aaiRes.json() as { upload_url: string };
    return Response.json({ uploadUrl: upload_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes(`${MAX_UPLOAD_MB} MB`) ? 413 : 500;
    return Response.json({ error: message }, { status });
  }
}
