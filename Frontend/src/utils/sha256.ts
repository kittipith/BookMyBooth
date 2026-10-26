const isPrime = (n: number) => {
  for (let f = 2; f * f <= n; f++) if (n % f === 0) return false
  return true
}

const frac32 = (x: number) => ((x - Math.floor(x)) * 2 ** 32) >>> 0

const PRIMES: number[] = []
for (let n = 2; PRIMES.length < 64; n++) if (isPrime(n)) PRIMES.push(n)

const INIT = PRIMES.slice(0, 8).map((p) => frac32(Math.sqrt(p)))
const K = PRIMES.map((p) => frac32(Math.cbrt(p)))

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

export function sha256(message: string): string {
  const bytes = new TextEncoder().encode(message)
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  const bitLength = bytes.length * 8
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32))
  view.setUint32(padded.length - 4, bitLength >>> 0)

  const h = [...INIT]
  const w = new Uint32Array(64)
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(i + t * 4)
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let t = 0; t < 64; t++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      hh = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    ;[a, b, c, d, e, f, g, hh].forEach((v, j) => (h[j] = (h[j] + v) | 0))
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}
