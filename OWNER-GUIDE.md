# Triple R Dump — How the new website works

For Joseph. Written to be read straight through, and to double as the running
order for the walkthrough video.

> A short version of this lives inside your admin panel too — it's the first
> tab, **"How this works."** So you never have to go looking for this file.

Nothing here needs a computer science degree. There is really only **one new
habit** to learn (see step 3). Everything else is the system working for you.

---

## The short version

1. A customer books and **pays in full on the website**. You don't chase anybody.
2. **You get a text** with the job and a link to all the details.
3. When you pick the bin back up, **open the job and tap "Mark picked up / completed."**
4. That triggers the review request automatically.

If you only remember one thing, remember step 3.

---

## 1. Where your work shows up

Every time someone books, you get a text that looks like this:

```
📦 NEW BOOKING — TRD-ABC123

20yd bin | 1-3 day rental
Customer: Jane Doe
Drop Date: 2026-08-20
Address: 123 Main St, West Haven UT
Phone: 8015550123
Total: $376.25

https://www.triplerdump.com/admin/booking/TRD-ABC123
```

Tap the link at the bottom. That opens the job page with everything: the address
with **Google Maps and Apple Maps buttons**, the customer's phone, anything they
typed in the "Anything else?" box, and what they paid.

You log in once with your password and it remembers you for a week.

**The reference number** (TRD-ABC123) is how you find any job later. Customers get
it in their confirmation text too, so if someone calls, ask for it.

---

## 2. Reminders — the part you were looking forward to

Four texts go out automatically, every day at 10:00 AM:

| When | Who gets it | What it says |
|---|---|---|
| Day before delivery | You **and** the customer | Deliver this bin tomorrow |
| Day before pickup | The customer | We pick up tomorrow — call to extend |
| **Morning of pickup** | **You** | Pick up this bin today, here's the address |
| Day after pickup | You | Only if you never marked the job done — tap the link to close it |

The morning-of text is the one for forgotten bins. The day-after text is the
safety net for forgotten *taps*: if a job's pickup date has passed and it was
never marked picked up, you get one reminder with a link straight to the job —
press the green button and it's closed (and the customer gets their review ask).

The customer's day-before-pickup text tells them to call you if they need it
longer, and quotes the extra-day price. That means fewer surprise "I still have
it" calls, and when they do call, they already know it costs extra.

### When someone wants to keep it longer

Open the job → **Pickup date** → pick the new date → Update.

That does three things: it stops the bin being offered to someone else on those
days, it re-arms the pickup reminders for the new date, and it writes a note on
the job so you have a record. Then charge the extra days in Stripe (next section).

---

## 3. Marking a job complete — the one habit

When the bin is back on the truck, open the job and tap the green
**"✓ Mark picked up / completed"** button.

You'll see a green confirmation right away — "marked picked up, the customer's
review text is on its way" — so you always know it worked.

This is the only thing the system can't figure out on its own, and it's what
kicks off the review request. If you skip it, the day-after reminder text will
catch it — but the habit is better than the safety net.

The admin home page also lists it for you: jobs to deliver today, jobs to pick
up today (each with its own green button), and anything overdue for closing sits
at the top in its own highlighted box.

**What happens then:** the customer gets a text asking how it went. If they say
4 or 5 stars, they go straight to your Google review page. If they say 3 or
less, it comes privately to you as a text instead, with their comment — so you
hear about a problem before the internet does.

Someone who's already left you a review won't be asked again.

### If they ignore it

Most people don't answer the first text. So the website nudges them, then gives
up gracefully:

| | When | What it says |
|---|---|---|
| First ask | The moment you mark it complete | "How did we do?" |
| Nudge 1 | 24 hours later | "Did you get a chance…" |
| Nudge 2 | 24 hours after that | "One more nudge, thirty seconds" |
| Nudge 3 | 48 hours after that | "Last time we'll ask" |

Then it stops permanently. Nobody ever gets a fourth.

**The nudges stop the instant they respond** — and that includes just *opening*
the link, even if they never pick a star. So someone who taps through and gets
distracted is never pestered again.

You can change the timing in **Reviews** and the wording in **Texts**. Putting
`0` in one of the nudge boxes switches that nudge off.

---

## 4. Money

### Getting paid
Residential customers **pay in full when they book**. The money is in Stripe
before you drive anywhere. Nothing to collect, no invoice to send.

### Refunds and cancellations
Done in the **Stripe dashboard**, not on the website. That's deliberate — it
keeps refunds in the one place with a real audit trail.

### Charging extra later (overages, damage, trip fees)

**For jobs booked online:** the customer's card is saved. You can charge it
later from the Stripe dashboard without them being present. They agreed to this
in the terms when they booked — dry runs, weight overages, banned items, extra
days are all listed there with prices.

**For jobs you invoiced:** ⚠️ **there is NO card saved.** This is a Stripe
limitation, not a setting we can flip. If an invoiced job runs over, **send a
second invoice**. Don't promise a customer "we'll just put it on your card"
unless they booked and paid online.

Rule of thumb: **paid online = card on file. Invoiced = no card.**

### Invoices
For commercial work and anything you quote by hand. Admin → **Invoices** → New
invoice. Add your own line items and quantities, pick a due date, and Stripe
emails it with a pay link. The customer also gets a text with the link.

Your payment terms and late fee print at the bottom of every invoice
automatically. If you're invoicing a job that's already in the system, open the
job and use "Create an invoice for this booking" so it fills in their details.

**When an invoice gets paid** you get a text ("Paid! Invoice 1042: $450.00 from
Mike Smith") within about an hour, with a link to it. The wording is in
Admin → Texts → "Invoice paid".

**Review texts for invoiced jobs:** on the New invoice screen, "Text a review
request when this invoice is paid" is ticked by default. When they pay, the
customer gets the same review text (and the same polite follow-ups) as a
picked-up job. It needs their phone number on the invoice, and it never asks
someone twice: anyone who already rated you, or was asked in the last 30 days,
is skipped. **Untick it for deposits or jobs you haven't done yet.** Invoices
made before Sep 24, 2026 never send a review text.

**Late payers:** once an invoice is past its due date, the customer gets a text
with the pay link at 10am, then every 48 hours, until they pay (up to 5 texts).
It re-checks with Stripe first, so nobody who already paid gets chased. After the
5th, it stops and texts **you** to give them a call. Paying or voiding the invoice
stops it. Admin → Invoices has the on/off switch, the 48 hours and the 5; the
wording is in Admin → Texts ("Late-payment text" and "Invoice still unpaid").

### Discount codes

Admin → **Discounts**. Make a code (say `MILITARY10`), give it a percent, and
save. As you type, it shows you an example of what that percent does to a
25-yard bin so you can sanity-check the number before it goes live.

- **On the website:** customers type the code in the "Promo code" box when they
  book. The discount comes off before tax, they see it on the price summary and
  on the Stripe payment page, and it's recorded on the booking.
- **On invoices:** the New Invoice page has a Discount box — pick one of your
  saved codes, or type a one-off percent for just that invoice. It shows as its
  own line on the bill.
- Untick **On** to pause a code without deleting it. Anyone who has the code
  can use it, so only hand it out where you mean to.

---

## 5. Things the website does on its own

Don't be surprised by these — they're all deliberate:

- **Refuses far-away addresses.** Anything more than 60 miles out can't book
  online; they're told to call you instead. So if someone phones saying "the
  website wouldn't let me," that's it working. You decide if you want the job.
- **Junk removal is weekends only.** Weekday requests are refused automatically.
- **Won't overbook you.** It knows how many bins you own and won't rent out a
  bin that's already sitting in someone's driveway.
- **Blocks spam.** If a real customer ever says "the website told me to call
  you," just take the booking over the phone — that's the spam filter being
  cautious, and it's rare.
- **Frees up abandoned checkouts.** If someone starts checkout and wanders off,
  the slot frees itself — instantly if they back out of the payment page, within
  the hour at worst. And if they come back to try again, their earlier attempt
  never blocks them.

---

## 6. The settings page (Admin)

You can change these yourself, no developer needed. Changes go live instantly.

| Tab | What it's for |
|---|---|
| **Prices** | Bin prices and sales tax |
| **Extra fees** | Dry run, overweight, extra day, banned items. **These rewrite your Terms page automatically** |
| **Discounts** | Promo codes (like `MILITARY10`) customers type at checkout; usable on invoices too |
| **Bins** | How many of each size you own, and how far you'll deliver |
| **Invoices** | Default due date and the terms printed on invoices |
| **Alerts** | Your phone number and which texts you want |
| **Reviews** | Your Google review link, the star cutoff, and the nudge timing |
| **Texts** | The exact wording of every text the site sends, nudges included |
| **Bookings** | Recent jobs and customer ratings |

**Two rules:**

1. In the **Texts** tab, anything in `{curly braces}` gets swapped for the real
   detail — `{name}` becomes the customer's name. Reword around them freely, but
   don't delete them. And **never leave a text box empty** — an empty box means
   that text stops sending.
2. **Leave the Advanced tab alone.** That's plumbing. Changing it can stop
   bookings, texts, or payments from working.

---

## 7. What isn't built yet

So you're not waiting on things that aren't coming:

- **Branded email.** Texts are the notification channel today.
- **Refunds from the website.** Stripe dashboard only, on purpose.

---

## 8. If something looks wrong

- **A customer says they paid but got no text** — look the job up by reference
  number in Admin → Bookings. The page tells you the truth about whether the
  payment landed.
- **You need a job gone** — open it and use Delete. That's permanent.
- **Something's genuinely broken** — call Boston. Don't start changing settings
  to fix it; that usually makes it harder to find.

---

## Quick reference

| | |
|---|---|
| Your website | https://www.triplerdump.com |
| Book a job | https://www.triplerdump.com/book |
| Your admin | https://www.triplerdump.com/admin |
| Your terms | https://www.triplerdump.com/terms |
| Payments | Stripe dashboard |
| Password | Ask Boston — not written down here on purpose |
