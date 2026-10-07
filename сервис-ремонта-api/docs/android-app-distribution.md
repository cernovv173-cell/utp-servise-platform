# Android APK distribution

- Administrators manage the Android release from **Администрирование → Android-приложение — APK** in the Web application.
- The API accepts an Android APK up to 100 MiB only from an authenticated `ADMIN`. It stores file bytes in Amazi project object storage and keeps the object ID, size, SHA-256, upload time, and any pending cleanup IDs in the `app_settings` row with key `android_app_apk`.
- `GET /api/android-app` exposes only current-file metadata. `GET /api/android-app/download` redirects to an expiring HTTPS download URL for the active object. Before the first managed upload, it redirects to the existing Web APK asset; after deletion it returns 404 instead of restoring that fallback.
- Uploading a replacement activates the new object before removing the previous object. If object cleanup temporarily fails, its ID remains recorded and an administrator can retry cleanup from the panel. Deleting disables the public download link and removes the active object from project storage.
- The Web Android download button resolves the current state and uses the permanent API download route, so an uploaded APK replaces the former download without changing the Web page or its link.
- Android still requires the device owner to approve installation of an APK update. This workflow updates which file the site offers; it does not silently install packages on devices or replace Play Store / managed-device update delivery.
