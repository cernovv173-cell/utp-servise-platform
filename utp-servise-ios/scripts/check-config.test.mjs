import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("the shared website URL is usable by both HTTPS-only clients", () => {
  const config = JSON.parse(read("config/mobile.json"));
  const url = new URL(config.url);
  assert.equal(url.protocol, "https:");
  assert.ok(url.hostname);
  assert.equal(url.username, "");
  assert.equal(url.password, "");
});

test("both native build systems package the canonical configuration", () => {
  const gradle = read("android/app/build.gradle");
  const assets = gradle.match(/assets.srcDirs = \['([^']+)'\]/)?.[1];
  assert.ok(assets, "Android assets source directory is missing");
  const project = read("ios/WebViewApp.xcodeproj/project.pbxproj");
  const resource = project.match(/path = ([^;]+mobile.json);\s+sourceTree = SOURCE_ROOT/)?.[1];
  assert.ok(resource, "Xcode shared configuration resource is missing");
  const canonical = resolve(root, "config/mobile.json");
  assert.equal(resolve(root, "android/app", assets, "mobile.json"), canonical);
  assert.equal(resolve(root, "ios", resource), canonical);
});

test("Gradle can bootstrap without a global Gradle installation", () => {
  const wrapper = readFileSync(resolve(root, "android/gradle/wrapper/gradle-wrapper.jar"));
  assert.equal(
    createHash("sha256").update(wrapper).digest("hex"),
    "81a82aaea5abcc8ff68b3dfcb58b3c3c429378efd98e7433460610fecd7ae45f",
  );
  assert.match(
    read("android/gradle/wrapper/gradle-wrapper.properties"),
    /distributionSha256Sum=[a-f0-9]{64}/,
  );
  assert.ok(statSync(resolve(root, "android/gradlew")).mode & 0o111);
});

test("both Xcode configurations inherit local signing settings without target overrides", () => {
  const project = read("ios/WebViewApp.xcodeproj/project.pbxproj");
  const reference = project.match(
    /(\w+) = \{isa = PBXFileReference;[^\n]+path = Signing.xcconfig;/,
  )?.[1];
  assert.ok(reference);
  assert.equal(project.split(`baseConfigurationReference = ${reference};`).length - 1, 2);
  assert.doesNotMatch(
    project,
    /\b(?:DEVELOPMENT_TEAM|PRODUCT_BUNDLE_IDENTIFIER|CODE_SIGN_STYLE)\s*=/,
  );
  assert.match(read("ios/Signing.xcconfig"), /#include\? "Signing.local.xcconfig"/);
});

test("local signing credentials are excluded from version control and packaged resources", () => {
  const ignored = read(".gitignore").split(/\r?\n/);
  for (const path of [
    "android/signing.properties",
    "android/signing/",
    "ios/Signing.local.xcconfig",
  ]) {
    assert.ok(ignored.includes(path), `${path} must be ignored`);
  }
  const example = read("android/signing.properties.example");
  assert.match(example, /^storePassword=$/m);
  assert.match(example, /^keyPassword=$/m);
  const project = read("ios/WebViewApp.xcodeproj/project.pbxproj");
  const signingReference = project.match(
    /(\w+) = \{isa = PBXFileReference;[^\n]+path = Signing.xcconfig;/,
  )?.[1];
  assert.ok(signingReference);
  assert.ok(!project.includes(`fileRef = ${signingReference};`));
});
