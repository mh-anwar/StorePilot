// AES-256-GCM envelope encryption for per-org secrets. Key material comes
// from APP_ENCRYPTION_KEY (hex-encoded 32 bytes). In production you'd
// source this from KMS — for now an env var is fine, but we refuse to run
// without one so secrets can't be silently written in the clear.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "./db";
import { encryptedSecrets } from "./db/schema";
import { and, eq, sql } from "drizzle-orm";

function key(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex || hex.length < 64) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be a hex string of at least 64 chars (32 bytes)"
    );
  }
  return Buffer.from(hex.slice(0, 64), "hex");
}

export function encrypt(plaintext: string): {
  ciphertext: string;
  iv: string;
  tag: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decrypt(ciphertext: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

export async function putSecret(orgId: string, keyName: string, value: string) {
  const { ciphertext, iv, tag } = encrypt(value);
  await db
    .insert(encryptedSecrets)
    .values({ orgId, key: keyName, ciphertext, iv, tag })
    .onConflictDoUpdate({
      target: [encryptedSecrets.orgId, encryptedSecrets.key],
      set: { ciphertext, iv, tag, updatedAt: sql`NOW()` },
    });
}

export async function getSecret(
  orgId: string,
  keyName: string
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(encryptedSecrets)
    .where(
      and(eq(encryptedSecrets.orgId, orgId), eq(encryptedSecrets.key, keyName))
    );
  if (!row) return null;
  try {
    return decrypt(row.ciphertext, row.iv, row.tag);
  } catch {
    return null;
  }
}

export async function deleteSecret(orgId: string, keyName: string) {
  await db
    .delete(encryptedSecrets)
    .where(
      and(eq(encryptedSecrets.orgId, orgId), eq(encryptedSecrets.key, keyName))
    );
}
