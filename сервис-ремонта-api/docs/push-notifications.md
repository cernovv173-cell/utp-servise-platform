# Android push notifications

The Android client registers its Firebase Cloud Messaging device token after sign-in and removes it
when the user signs out. The API sends privacy-preserving notifications to the other participants
when a repair-chat message is posted, and to active administrators when a technician first requests
help. A repeated help request does not create a second alert. Message previews and repair details are
not included in the push payload; the payload carries only an event type and order ID.

Repair-order push events cover order creation and edits, planned completion changes, technician
assignment, status changes, service/part additions, bonus redemption, receipt generation/payment,
order photos, and review creation/moderation. Recipients are the customer, assigned technician, and
active administrators; the user who performed the action is excluded. News push goes to active
customers when an article is first published and is already visible. Draft edits and changes to an
already-published article do not send another alert. Future-scheduled news is not pushed when its
start time arrives because this API has no scheduled delivery worker.

FCM delivery is best-effort: a saved chat action remains successful if Firebase is temporarily
unavailable. Invalid and expired device tokens are deleted. A user may register the same app token
again after signing in, and a token is associated with only one account at a time.

When an administrator publishes giveaway results, the API creates one delivery record per winner in
the same transaction as the result publication and bonus awards. Each selected winner receives a
personal congratulatory push with their place, prize, and awarded bonus points; other participants
do not receive it. Repeating the publish request does not create another notification. Temporary
FCM failures are retried independently for each winner. A winner without a registered Android push
device remains queued; registering a device makes the pending congratulations eligible immediately.
The additive `20261109130000_customer_offer_winner_push_deliveries` migration also queues winners of
already-published giveaways once, without changing their published results or bonus transactions.

`FCM_SERVICE_ACCOUNT_JSON` is bound to the API only and must contain a Firebase Admin service
account authorized to send messages for the Firebase project. `UTP_FIREBASE_ANDROID_CONFIG_JSON` is
bound to Android builds and must include the `ru.utp.servise` Firebase Android app. Gradle writes
the supplied client configuration to the ignored `app/google-services.json` file for the Google
Services plugin; neither that generated file nor the Admin service-account credential belongs in
version control.
