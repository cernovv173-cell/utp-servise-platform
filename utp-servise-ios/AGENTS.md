# Application Agent Guidance

- Read only the documentation relevant to your changes: `README.md`.
- Inspect the existing files before editing.
- Set the website URL once in config/mobile.json. Android assets and the Xcode resources phase both package this file directly.
- Preserve the independent android/ and ios/ projects and HTTPS-only navigation. Keep platform logic in its native owner; do not add a fake browser preview.
- Keep commands and ports unset, preview/public routing disabled and editor adapters empty. Development tools node-22, java-17 and android-sdk-36 support source checks and Android builds.
- For requested Android builds, run the Gradle wrapper from android/ with --no-daemon --max-workers=2. Follow README.md for debug and signed release artifacts. Preserve existing signing identities. iOS builds need external macOS/Xcode.
- Report source checks, compilation and device verification separately. Neither a successful APK build nor the target website loading in a browser verifies this wrapper on a device.
- Store signing credentials outside source control. Do not add a JavaScript bridge or device permissions unless required by the user's requested behavior.
