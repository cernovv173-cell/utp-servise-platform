import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const android = fileURLToPath(new URL("../android/", import.meta.url));
const properties = `${android}signing.properties`;
const directory = `${android}signing`;
const keystore = `${directory}/release.p12`;

if (existsSync(properties) || existsSync(keystore)) {
  throw new Error("Signing files already exist; refusing to replace an existing signing identity.");
}
const probe = spawnSync("keytool", ["-help"], { stdio: "ignore" });
if (probe.error || probe.status !== 0) {
  throw new Error("Install a JDK with keytool before generating Android signing credentials.");
}

process.umask(0o077);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const password = randomBytes(32).toString("hex");
const result = spawnSync(
  "keytool",
  [
    "-genkeypair",
    "-noprompt",
    "-storetype",
    "PKCS12",
    "-keystore",
    keystore,
    "-alias",
    "release",
    "-keyalg",
    "RSA",
    "-keysize",
    "3072",
    "-validity",
    "10000",
    "-dname",
    "CN=WebView App, OU=Mobile, O=Independent, C=US",
    "-storepass:env",
    "WEBVIEW_SIGNING_PASSWORD",
    "-keypass:env",
    "WEBVIEW_SIGNING_PASSWORD",
  ],
  { env: { ...process.env, WEBVIEW_SIGNING_PASSWORD: password }, stdio: "inherit" },
);
if (result.error || result.status !== 0) {
  throw new Error("Key generation failed; signing.properties was not written.");
}
chmodSync(keystore, 0o600);
writeFileSync(
  properties,
  `storeFile=signing/release.p12\nstorePassword=${password}\nkeyAlias=release\nkeyPassword=${password}\n`,
  { mode: 0o600, flag: "wx" },
);
console.log("Created android/signing.properties and android/signing/release.p12.");
console.log("Keep both files private and back them up for future app updates.");
