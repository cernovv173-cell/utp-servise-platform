import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const KEY_LENGTH = 32;
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const derivePinHash = (pin: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(pin, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });

export const createPickupPinCredential = async (
  pin: string,
): Promise<{ hash: string; salt: string }> => {
  const salt = randomBytes(16);
  const hash = await derivePinHash(pin, salt);
  return { hash: hash.toString("hex"), salt: salt.toString("hex") };
};

export const verifyPickupPin = async (
  pin: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> => {
  if (!/^[a-f\d]{32}$/iu.test(salt) || !/^[a-f\d]{64}$/iu.test(expectedHash)) {
    return false;
  }
  const actual = await derivePinHash(pin, Buffer.from(salt, "hex"));
  return timingSafeEqual(Buffer.from(expectedHash, "hex"), actual);
};
