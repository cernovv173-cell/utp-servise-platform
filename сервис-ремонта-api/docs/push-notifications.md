# Android push notifications

The Android client registers its Firebase Cloud Messaging device token after sign-in and removes it
when the user signs out. The API sends privacy-preserving notifications to the other participants
when a repair-chat message is posted, and to active administrators when a technician first requests
help. A repeated help request does not create a second alert. Message previews and repair details are
not included in the push payload; the payload carries only an event type and order ID.

FCM delivery is best-effort: a saved chat action remains successful if Firebase is temporarily
unavailable. Invalid and expired device tokens are deleted. A user may register the same app token
again after signing in, and a token is associated with only one account at a time.

`FCM_SERVICE_ACCOUNT_JSON` is bound to the API only and must contain a Firebase Admin service
account authorized to send messages for the Firebase project. `UTP_FIREBASE_ANDROID_CONFIG_JSON` is
bound to Android builds and must include the `ru.utp.servise` Firebase Android app. Gradle writes
the supplied client configuration to the ignored `app/google-services.json` file for the Google
Services plugin; neither that generated file nor the Admin service-account credential belongs in
version control.
