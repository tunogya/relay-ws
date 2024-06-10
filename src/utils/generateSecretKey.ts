import { BN } from "bn.js";
import crypto from "crypto";

export const generateSecretKey = (saltHex: string, seed: string) => {
  const salt = new BN(saltHex, 16);

  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  const inputNumber = new BN(hash, 16);

  let privateKey = inputNumber.add(salt);
  const n = new BN(
    "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
    16,
  );
  privateKey = privateKey.mod(n);

  const privateKeyHex = privateKey.toString("hex").padStart(64, "0");
  const privateKeyBuffer = Buffer.from(privateKeyHex, "hex");
  return new Uint8Array(privateKeyBuffer);
};
