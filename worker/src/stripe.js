// Stripe Checkout — STUBBED until Joseph grants admin access and we get a
// valid restricted key (rk_test_ to build, rk_live_ for go-live).
//
// When the key lands, this creates a hosted Checkout Session via the Stripe
// REST API (no SDK, keeps the Worker dependency-free) and returns its URL. The
// restricted key stays a Worker secret — it never touches the repo or browser.

export async function createCheckout(env, booking) {
  if (!env.STRIPE_SECRET_KEY) {
    return { stubbed: true, url: null };
  }

  // --- Wiring to finish once the key is in ---
  // const form = new URLSearchParams();
  // form.set("mode", "payment");
  // form.set("success_url", `${env.SITE_ORIGIN}/booked?ref=${booking.id}`);
  // form.set("cancel_url", `${env.SITE_ORIGIN}/book`);
  // form.set("client_reference_id", booking.id);
  // form.set("line_items[0][quantity]", "1");
  // form.set("line_items[0][price_data][currency]", "usd");
  // form.set("line_items[0][price_data][unit_amount]", String(booking.amount_cents));
  // form.set("line_items[0][price_data][product_data][name]", `${booking.bin_size}yd dumpster — ${booking.rental_days}-day rental`);
  // const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
  //   method: "POST",
  //   headers: {
  //     authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
  //     "content-type": "application/x-www-form-urlencoded",
  //   },
  //   body: form,
  // });
  // const session = await res.json();
  // if (!res.ok) { console.error("[stripe]", session); return { url: null, error: true }; }
  // // persist session id against the booking here...
  // return { url: session.url, id: session.id };

  return { stubbed: true, url: null };
}
