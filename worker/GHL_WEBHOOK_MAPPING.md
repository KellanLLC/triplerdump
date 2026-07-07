# GHL Webhook Mapping - Triple R Dump

As of 2026-06-25 the Worker is a DUMB SMS RELAY. It POSTs a MINIMAL JSON payload to a
GoHighLevel **Inbound Webhook** for every text. There is NO `type` field and no rich
booking fields anymore - the message body is fully composed by the Worker.

## SMS webhook  (CMS -> Webhooks -> "SMS / confirmation webhook URL")
Current trigger id ends `...b0039c7f...` (older `...0b90a794...` / `...e05f015d...` are STALE).

Every SMS is its own POST:
```json
{ "number": "+18015551234", "message": "the exact text to send" }
```
**The only GHL workflow step needed: send `{{message}}` (SMS) to `{{number}}`.** That's it.
Recipients/wording are decided by the Worker (client vs owner, consent, templates).
VERIFIED 2026-06-25: GHL relays `{{message}}` -> `{{number}}` correctly (owner SMS w/ link received).

Texts the Worker sends (all identical shape - just number + message):
- Client booking confirmation (consent-gated by us; no consent = not sent).
- Owner booking alert (separate POST to the owner number; includes the /admin/booking/<ref> link).
- Client delivery reminder; Owner delivery reminder (toggleable in CMS).
- Review request (link to /r/<token>); on a low rating, an owner alert (with booking link).
- Commercial-lead alert to the owner.

## Email webhook (separate; optional; set when domain/email is ready)
Payload: `{ "email": "...", "subject": "...", "message": "..." }`.
Workflow: email `{{email}}` with `{{subject}}` / `{{message}}`.

## Notes
- Google Calendar: the old `event_*` fields were REMOVED with the minimal-payload switch.
  Owner can subscribe to the token-gated ICS feed (/calendar/<token>.ics), or wire a
  GHL/Google integration later.
- Review gating is enforced server-side (low raters never receive the Google link).
- The owner's wording (incl. the `{link}` token) is editable in the CMS SMS templates -
  keep `{link}` in the owner templates so Joseph gets the booking-page link.
