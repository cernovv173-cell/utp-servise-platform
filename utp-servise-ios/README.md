# Native WebView application

Two native applications load the same website using Android WebView and iOS WKWebView.
The shared **config/mobile.json** currently points both platforms to the production website at
`https://task.app.amazi.pro`. Both platforms package this exact file; no code generation or URL
synchronization is required. Change this URL only when intentionally switching the app's website.

## Platform support

Amazi can edit these sources and build Android APK/AAB files with the application's development
tools `node-22`, `java-17` and `android-sdk-36`. Existing applications can enable these tools through
the agent. Release signing uses your configured signing identity below. iOS requires macOS/Xcode.
Keep runtime commands and ports unset and preview/public routing disabled. Amazi does not supply
an emulator or store submission. A browser visit checks the website only; successful compilation
does not verify device behavior. There is intentionally no Dockerfile or web development server.

## Android

Requires Android SDK 36, build tools 35.0.0 and JDK 17, supplied by the Amazi development tools.
For local device/emulator testing, open `android/` in Android Studio and let it locate your SDK
(or set ANDROID_HOME locally).
The included Gradle 8.13 wrapper and Android Gradle Plugin 8.11.1 download on first use.
In Amazi run `cd android && ./gradlew --no-daemon --max-workers=2 assembleDebug`; find the APK under
`app/build/outputs/apk/debug/`. Minimum Android version is 8.0 (API 26).
Set the app name in `app/src/main/res/values/strings.xml` and the unique `applicationId` in
`app/build.gradle` before distribution. Android Studio's Generate Signed Bundle/APK workflow owns
release signing. Alternatively use the signing configuration below. Never commit keystores or passwords.

## iOS

Requires macOS with Xcode and the iOS SDK; deployment target is iOS 15. Open
`ios/WebViewApp.xcodeproj`, select the shared WebViewApp scheme and run on an iOS simulator.
For a device, set your development team and a unique bundle identifier in Signing & Capabilities.
The application display name is in `ios/WebViewApp/Info.plist`. You can also build a simulator target
with `xcodebuild -project ios/WebViewApp.xcodeproj -scheme WebViewApp -sdk iphonesimulator
-destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`.
Add your final AppIcon asset set and signing team before using Product > Archive for distribution.
A successful debug build is not a signed or store-approved release.

## Signing configuration

Android release builds read `android/signing.properties` with `storeFile`, `storePassword`,
`keyAlias` and `keyPassword`. Copy `android/signing.properties.example` to that path and fill it
with your existing keystore details, or run `npm run signing:android` with a JDK installed to
generate a new RSA key and random password locally. The generator refuses to replace existing
signing files. Keystore paths are absolute or relative to `android/`.
Generated credentials are private files excluded from Git; keep a secure backup of both
`android/signing.properties` and `android/signing/release.p12` for future updates.
Run `cd android && ./gradlew assembleRelease` for a signed APK or `./gradlew bundleRelease`
for a signed app bundle. Release builds fail when signing settings are missing; debug builds
continue to use Android's development key.

Both Xcode configurations use `ios/Signing.xcconfig`, which optionally includes the ignored
`ios/Signing.local.xcconfig`. Copy `ios/Signing.local.xcconfig.example` to that path, then set
your real `DEVELOPMENT_TEAM` and unique `PRODUCT_BUNDLE_IDENTIFIER`. Automatic signing uses
your Apple account and certificates in Xcode; a Team ID alone does not provide credentials.
Simulator builds with `CODE_SIGNING_ALLOWED=NO` do not require a team.
These local signing files are not packaged as application resources.

## Included behavior

- Shared HTTPS URL configuration, JavaScript and persistent website sessions.
- Warranty claims use the shared customer website: the device history offers a claim only for an unexpired warranty on the customer's completed repair. The server rechecks the warranty and owner, creates a new order linked to the original repair, and opens that order's separate chat in the same WebView. No native JavaScript bridge or duplicate warranty policy is used.
- Loading indicator, network error with retry, and back navigation; iOS also has forward/reload controls.
- HTTPS links remain in the view; tel/mailto/sms links open the appropriate system application.
- New-window links on iOS are loaded in the same view. No native JavaScript bridge is exposed.
- TLS errors are rejected. Cleartext HTTP, local files and arbitrary URL schemes are blocked.

The website must work in embedded browsers. Third-party sign-in can require an external-browser
flow. File upload/download, push notifications, camera/microphone access, native payments and custom
URL callbacks are not implemented. Add them deliberately when required and test both platforms on
devices. Before distribution choose app identifiers, names and icons and configure signing.
Keep the site available over HTTPS.

## Source checks

With Node.js available locally, run `npm run check` to validate the shared URL and resource references.
These checks do not compile Java/Swift or verify device behavior.
