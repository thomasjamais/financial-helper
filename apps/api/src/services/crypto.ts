import crypto from 'crypto'

export function makeEncryptDecrypt(encKey: string) {
  const key = encKey.padEnd(32, '0').slice(0, 32)
  function encrypt(text: string): string {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv)
    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([iv, tag, enc]).toString('base64')
  }
  function decrypt(b64: string): string {
    const buf = Buffer.from(b64, 'base64')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const data = buf.subarray(28)
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key),
      iv,
    )
    decipher.setAuthTag(tag)
    const dec = Buffer.concat([decipher.update(data), decipher.final()])
    return dec.toString('utf8')
  }
  return { encrypt, decrypt }
}
