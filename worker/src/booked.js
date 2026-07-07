// Post-checkout landing for /booked?ref=<id>. Stripe redirects here on success,
// but customers can also land here late (history, refreshed link), so the page
// tells the truth per status — confirmPaidByRedirect() has already run:
//   paid / confirmed / completed -> confirmed panel (+ what was charged)
//   pending   -> payment not confirmed yet (auto-rechecks via meta refresh)
//   cancelled -> nothing booked, date released, nothing charged
//   unknown   -> neutral "couldn't find that reference"
// CLEAN/minimal aesthetic to match the checkout page (light bg, card).

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function renderBookedPage(S, booking) {
  const biz = (S && S.business) || {};
  const phone = biz.phone || "";
  const status = booking ? String(booking.status || "") : "";
  const paid = !!(booking && (status === "paid" || booking.paid_at));
  const confirmed = paid || status === "confirmed" || status === "completed";
  const cancelled = status === "cancelled";
  const pending = !!booking && !confirmed && !cancelled;
  const ref = booking ? esc(booking.id) : "";
  const name = booking ? esc(String(booking.customer_name || "").split(/\s+/)[0]) : "";
  // What the card is actually charged = service total + refundable deposit (trailer).
  const totalCents = booking ? (booking.amount_cents || 0) + (booking.deposit_cents || 0) : 0;
  const depositCents = booking ? (booking.deposit_cents || 0) : 0;

  let icon = "✓", iconClass = "check", heading, sub;
  if (!booking) {
    icon = "?"; iconClass = "check neutral";
    heading = "We couldn't find that booking";
    sub = "Double-check the link from your text or email" + (phone ? ", or call " + phone + " and we'll look it up." : ".");
  } else if (confirmed) {
    heading = paid ? "Payment received — you're booked!" : "You're booked!";
    sub = paid
      ? "Your payment went through and your spot is locked in. A confirmation text is on its way."
      : "Your spot is locked in. A confirmation text is on its way.";
  } else if (cancelled) {
    icon = "!"; iconClass = "check warn";
    heading = "This booking wasn't completed";
    sub = "The payment didn't go through, so nothing was booked and the date was released. You're welcome to book again" + (phone ? " — and if you believe you were charged, call " + phone + " and we'll make it right." : ".");
  } else {
    icon = "…"; iconClass = "check neutral";
    heading = "Confirming your payment…";
    sub = "We haven't received Stripe's confirmation yet. If you just paid, this page re-checks automatically and your text confirmation will follow. If you didn't finish checkout, the hold releases by itself and nothing is charged.";
  }

  let summary = "";
  if (booking && (confirmed || pending)) {
    summary = `<div class="sum">
         <div class="row"><span>Reference</span><b>${ref}</b></div>
         ${booking.delivery_date ? `<div class="row"><span>Delivery</span><b>${esc(booking.delivery_date)}</b></div>` : ""}
         ${booking.amount_cents != null ? `<div class="row"><span>${confirmed ? "Total paid" : "Total"}</span><b>$${(totalCents / 100).toFixed(2)}</b></div>` : ""}
         ${depositCents > 0 ? `<div class="row"><span>Includes refundable deposit</span><b>$${(depositCents / 100).toFixed(2)}</b></div>` : ""}
       </div>`;
  } else if (booking && cancelled) {
    summary = `<div class="sum"><div class="row"><span>Reference</span><b>${ref}</b></div></div>`;
  } else if (!booking) {
    summary = `<p class="muted">If you have your reference number, keep it handy.${phone ? " Questions? Call " + esc(phone) + "." : ""}</p>`;
  }

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${pending ? '<meta http-equiv="refresh" content="6">' : ""}
<title>${confirmed ? "Booking confirmed" : "Booking status"} — Triple R Dump</title>
<style>
  :root { --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --accent:#116DFF; --bg:#f6f8fb; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
  .card { background:#fff; border:1px solid var(--line); border-radius:16px; max-width:460px; width:100%; padding:32px; box-shadow:0 10px 30px rgba(15,23,42,.06); text-align:center; }
  .check { width:56px; height:56px; border-radius:50%; background:#e8f0ff; color:var(--accent); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:28px; }
  .check.warn { background:#fdeced; color:#c0392b; }
  .check.neutral { background:#eef2f7; color:var(--muted); }
  h1 { font-size:22px; margin:0 0 8px; }
  p { color:var(--muted); margin:0 0 16px; }
  .sum { text-align:left; border-top:1px solid var(--line); margin-top:20px; padding-top:16px; }
  .row { display:flex; justify-content:space-between; padding:6px 0; }
  .row span { color:var(--muted); }
  .muted { color:var(--muted); }
  a.btn { display:inline-block; margin-top:20px; color:var(--accent); text-decoration:none; font-weight:600; }
</style></head>
<body><div class="wrap"><div class="card">
  <div class="${iconClass}">${icon}</div>
  <h1>${esc(heading)}</h1>
  <p>${name && confirmed ? "Thanks, " + name + "! " : ""}${esc(sub)}</p>
  ${summary}
  <a class="btn" href="${cancelled ? "/book" : "/"}">${cancelled ? "Try booking again →" : "← Back to Triple R Dump"}</a>
</div></div></body></html>`;
}
