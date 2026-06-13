import { Router, Request, Response } from "express";
import crypto from "node:crypto";
import stringify from "safe-stable-stringify";

const router = Router();

type Jwk = { kty: "OKP"; crv: "Ed25519"; kid: string; x: string };
type Jwks = { keys: Jwk[] };

let jwksCache: { fetchedAt: number; keys: Map<string, crypto.KeyObject> } | null = null;
const JWKS_TTL_MS = 10 * 60_000; // 10 minutes
const JWKS_URL = "https://relayer.1shotapi.com/.well-known/jwks.json";

async function getJwks(force = false): Promise<Map<string, crypto.KeyObject>> {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  
  try {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
    const { keys } = (await res.json()) as Jwks;
    const map = new Map<string, crypto.KeyObject>();
    for (const k of keys) {
      if (k.kty === "OKP" && k.crv === "Ed25519") {
        const pubKey = crypto.createPublicKey({
          key: { kty: k.kty, crv: k.crv, x: k.x },
          format: "jwk"
        });
        map.set(k.kid, pubKey);
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
  const messageStr = stringify(rest) as string;
  const message = Buffer.from(messageStr);
  const sig = Buffer.from(sigB64, "base64");
  
  console.log("[1shot-webhook-debug] Full body received:", JSON.stringify(body));
  console.log("[1shot-webhook-debug] Canonical messageStr:", messageStr);
  console.log("[1shot-webhook-debug] sigB64:", sigB64);
  console.log("[1shot-webhook-debug] pubKey JWK kid:", keyId);
  
  try {
    const isValid = crypto.verify(null, message, pub, sig);
    console.log("[1shot-webhook-debug] isValid:", isValid);
    return isValid;
  } catch (err: any) {
    console.error("[1shot-webhook-debug] crypto.verify threw an error:", err.message);
    return false;
  }
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
