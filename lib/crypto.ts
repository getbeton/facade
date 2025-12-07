import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
    const keyString = process.env.ENCRYPTION_KEY || '0'.repeat(64)
    if (keyString.length !== 64) {
        throw new Error(`Invalid ENCRYPTION_KEY length: ${keyString.length}. Must be 64 hex characters (32 bytes).`)
    }
    return Buffer.from(keyString, 'hex')
}

/**
 * Encrypts a plaintext string using AES-256-GCM
 * @param plaintext The string to encrypt
 * @returns Encrypted string in format: iv:authTag:encrypted (all hex-encoded)
 */
export function encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Return: iv + authTag + ciphertext (all hex-encoded, delimited by :)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts a ciphertext string encrypted with the encrypt() function
 * @param ciphertext The encrypted string in format: iv:authTag:encrypted
 * @returns Decrypted plaintext string
 */
export function decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':')

    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)

    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}
