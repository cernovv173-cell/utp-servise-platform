# Customer support and administrator customer records

## Customer-to-administrator support chat

- A support conversation belongs to exactly one customer account and is separate from order chats.
- Customers can read and send messages only in their own conversation. An empty conversation is not stored until the customer sends the first message.
- Administrators can browse the latest 100 conversations, open a customer's history, and reply. Each conversation returns at most its latest 100 messages in chronological order.
- Messages and conversations are retained with the account. Deleting a conversation is not exposed by the API.
- Push notifications are attempted for the other side of a message; in-app refresh remains available when push is not configured.

## Customer directory

- The `/admin/customers` list and customer edits require an authenticated administrator session.
- Search matches customer name, email, or phone. Results are paginated; the response contains only contact fields and account status, never password hashes or session tokens.
- Administrators can update a customer's display name, sign-in email, and phone number. Email uniqueness and phone format are validated by the API.
- The directory does not expose role changes, passwords, session tokens, or customer deletion.

## Removing a technician

- `DELETE /staff/:userId` is a reversible deactivation, not a destructive account or history deletion.
- The API revokes the technician's sessions and rejects removal while the technician has unfinished assigned orders. The administrator must reassign or complete those orders first.
- Past orders, order messages, reviews, and audit history remain intact. An administrator may reactivate an inactive technician later.
