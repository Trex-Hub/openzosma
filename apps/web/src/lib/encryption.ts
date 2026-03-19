import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16 // 128-bit IV for GCM
const TAG_LENGTH = 16 // 128-bit auth tag
const KEY_LENGTH = 32 // 256-bit key

/**
 * Derives the 256-bit encryption key from the ENCRYPTION_KEY env variable.
 * Falls back to a deterministic key derived from a default secret in development.
 */
function getencryptionkey(): Buffer {
	const raw = process.env.ENCRYPTION_KEY
	if (!raw) {
		if (process.env.NODE_ENV === "production") {
			throw new Error("ENCRYPTION_KEY environment variable is required in production")
		}
		// Dev-only fallback — derive a consistent 32-byte key from a fixed phrase
		return crypto.scryptSync("dev-encryption-secret-do-not-use", "salt", KEY_LENGTH)
	}
	// If the key is a hex string of exactly 64 chars → use directly
	if (/^[0-9a-f]{64}$/i.test(raw)) {
		return Buffer.from(raw, "hex")
	}
	// Otherwise derive a key from the raw passphrase
	return crypto.scryptSync(raw, "openzosma-salt", KEY_LENGTH)
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64-encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
	const key = getencryptionkey()
	const iv = crypto.randomBytes(IV_LENGTH)
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

	const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
	const tag = cipher.getAuthTag()

	// Pack: [iv (16)] [tag (16)] [ciphertext (...)]
	const packed = Buffer.concat([iv, tag, encrypted])
	return packed.toString("base64")
}

/**
 * Decrypts a base64 string produced by `encrypt()`.
 */
export function decrypt(encryptedbase64: string): string {
	const key = getencryptionkey()
	const packed = Buffer.from(encryptedbase64, "base64")

	const iv = packed.subarray(0, IV_LENGTH)
	const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
	const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH)

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
	decipher.setAuthTag(tag)

	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
	return decrypted.toString("utf8")
}
