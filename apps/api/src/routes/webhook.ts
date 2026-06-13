import { Router, Request, Response } from "express";
import stringify from "safe-stable-stringify";

const router = Router();
// Crypto injection removed: using verifyAsync instead.

type Jwk = { kty: "OKP"; crv: "Ed25519"; kid: string; x: string };
type Jwks = { keys: Jwk[] };

let jwksCache: { fetchedAt: number; keys: Map<string, Uint8Array> } | null = null;
const JWKS_TTL_MS = 10 * 60_000; // 10 minutes
const JWKS_URL = "https://relayer.1shotapi.com/.well-known/jwks.json";

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64url.length + (4 - (b64url.length % 4)) % 4, "=");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function getJwks(force = false): Promise<Map<string, Uint8Array>> {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  
  try {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const { keys } = (await res.json()) as Jwks;
    const map = new Map<string, Uint8Array>();
    for (const k of keys) {
      if (k.kty === "OKP" && k.crv === "Ed25519") {
        map.set(k.kid, base64urlToBytes(k.x));
      }
    }
    jwksCache = { fetchedAt: Date.now(), keys: map };
    return map;
  } catch (err: any) {
    console.error("[1shot-webhook] Error fetching JWKS:", err.message);
    throw err;
  }
}

async function verifyRelayerWebhook(body: Record<string, unknown>): Promise<boolean> {
  const sigB64 = body.signature as string | undefined;
  const keyId = body.keyId as string | undefined;
  if (!sigB64 || !keyId) return false;

  let keys = await getJwks();
  let pub = keys.get(keyId);
  if (!pub) {
    keys = await getJwks(true); // force refresh on miss (key rotation)
    pub = keys.get(keyId);
    if (!pub) return false;
  }

  const { signature: _omit, ...rest } = body; // canonicalize without signature
  const message = new TextEncoder().encode(stringify(rest) as string);
  const sig = new Uint8Array(Buffer.from(sigB64, "base64"));
  
  // Dynamically import ESM-only module to avoid ERR_REQUIRE_ESM in CommonJS
  // Using eval prevents TypeScript from transpiling it into a require()
  const ed = await eval("import('@noble/ed25519')");
  return await ed.verifyAsync(sig, message, pub);
}

/**
 * POST /api/webhook/1shot
 * Receives real-time status updates from 1Shot Relayer.
 */
router.post("/1shot", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    
    // Verify Ed25519 signature
    const isValid = await verifyRelayerWebhook(body);
    if (!isValid) {
      console.warn("[1shot-webhook] ❌ Invalid signature or missing keys.");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Process valid webhook event
    const type = body.type; // 4: Submitted, 0: Confirmed, 1: Reverted
    const data = body.data as { id: string; status: number; memo?: string; hash?: string; receipt?: any };

    console.log(`[1shot-webhook] ✅ Verified event! Type: ${type}, TaskId: ${data?.id}, Memo: ${data?.memo}`);
    
    if (type === 0) {
      console.log(`[1shot-webhook] 🎉 Task ${data?.id} CONFIRMED! Hash: ${data?.receipt?.transactionHash || data?.hash}`);
      // TODO: Here we could notify the frontend via SSE or update the database
    } else if (type === 1) {
      console.error(`[1shot-webhook] ❌ Task ${data?.id} FAILED/REVERTED!`);
    } else if (type === 4) {
      console.log(`[1shot-webhook] ⏳ Task ${data?.id} SUBMITTED to mempool. Hash: ${data?.hash}`);
    }

    // Acknowledge receipt quickly to prevent relayer retries
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("[1shot-webhook] ❌ Server error processing webhook:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
