// Review funnel landing at /r/<token> + the rating-routing handlers.
// Gating is enforced server-side: the Google link is only returned by the API
// when the rating qualifies, so low-rating customers never receive it.
import { notifyOwnerLowRating } from "./sms.js";
import { stopReviewLadder, findReviewSubject } from "./review.js";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderReviewLanding(S, token, firstName) {
  const star = '&#9733;';
  const stars = [1, 2, 3, 4, 5].map((n) =>
    '<button class="star" data-n="' + n + '" aria-label="' + n + ' star">' + star + '</button>'
  ).join("");
  const hi = firstName ? (", " + esc(firstName)) : "";
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
'<meta name="viewport" content="width=device-width,initial-scale=1"><title>Rate Triple R Dump</title><style>' +
'body{margin:0;font:17px/1.5 system-ui,Segoe UI,Roboto,sans-serif;color:#0b1b2b;background:#f5f8fc}' +
'.wrap{max-width:480px;margin:0 auto;padding:46px 20px;text-align:center}' +
'h1{font-size:26px;margin:0 0 6px}p.sub{color:#5a6b7d;margin:0 0 26px}' +
'#stars{display:flex;gap:6px;justify-content:center;margin:10px 0 8px}' +
'.star{font-size:46px;line-height:1;background:none;border:0;cursor:pointer;color:#cfd8e3;transition:color .1s;padding:2px 4px}' +
'.star:hover,.star.on{color:#f5b301}' +
'.card{background:#fff;border:1px solid #dde5ef;border-radius:14px;padding:22px;margin-top:18px;text-align:left}' +
'textarea{width:100%;min-height:96px;margin-top:8px;padding:11px;border:1px solid #dde5ef;border-radius:9px;font:inherit}' +
'a.btn,button.btn{display:block;width:100%;text-align:center;margin-top:12px;background:#116DFF;color:#fff;border:0;border-radius:10px;padding:14px;font-size:16px;font-weight:700;cursor:pointer;text-decoration:none;box-sizing:border-box}' +
'.muted{color:#5a6b7d;font-size:14px}</style></head><body><main class="wrap">' +
'<h1>How did we do' + hi + '?</h1><p class="sub">Tap a star to rate your Triple R Dump experience.</p>' +
'<div id="stars">' + stars + '</div><div id="next"></div></main>' +
'<script>var TOKEN=' + JSON.stringify(token) + ';(function(){' +
'var stars=[].slice.call(document.querySelectorAll(".star")),next=document.getElementById("next"),done=false;' +
'function paint(n){stars.forEach(function(s,i){s.classList.toggle("on",i<n);});}' +
'stars.forEach(function(s){' +
's.addEventListener("mouseenter",function(){if(!done)paint(+s.dataset.n);});' +
's.addEventListener("mouseleave",function(){if(!done)paint(0);});' +
's.addEventListener("click",function(){if(done)return;done=true;paint(+s.dataset.n);rate(+s.dataset.n);});});' +
'function esc(t){var d=document.createElement("div");d.textContent=t;return d.innerHTML;}' +
'async function rate(n){' +
'try{var r=await fetch("/api/review",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:TOKEN,rating:n})});var j=await r.json();}catch(e){next.innerHTML="<div class=card>Thanks for your feedback!</div>";return;}' +
'if(!j.ok){next.innerHTML="<div class=card>This link has expired. Thanks anyway!</div>";return;}' +
'if(j.action==="feedback"){feedbackForm("We are sorry we missed the mark. What could we have done better?");return;}' +
'if(j.action==="google"){window.location.href=j.url;return;}' +
'var g="<div class=card><b>Thank you!</b><p class=muted>Mind sharing it on Google? It really helps a small local business.</p><a class=btn href="+JSON.stringify(j.url)+" target=_blank rel=noopener>Leave a Google review</a></div>";' +
'next.innerHTML=g;feedbackForm("Anything else you want us to know? (optional)",true);}' +
'function feedbackForm(prompt,append){var html="<div class=card><b>"+esc(prompt)+"</b><textarea id=fb></textarea><button class=btn id=sb>Send to Triple R Dump</button></div>";if(append){next.innerHTML+=html;}else{next.innerHTML=html;}' +
'document.getElementById("sb").addEventListener("click",async function(){var fb=document.getElementById("fb").value;this.disabled=true;' +
'try{await fetch("/api/review/feedback",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:TOKEN,feedback:fb})});}catch(e){}' +
'this.parentNode.innerHTML="<b>Thank you</b><p class=muted>We appreciate you letting us know - we will make it right.</p>";});}' +
'})();</script></body></html>';
}

export async function handleReviewRate(env, S, body) {
  const tok = String(body.token || "");
  const rating = parseInt(body.rating, 10);
  if (!tok || !(rating >= 1 && rating <= 5)) return { ok: false, error: "bad request" };
  const s = await findReviewSubject(env, tok);
  const b = s && s.row;
  if (!b) return { ok: false, error: "not found" };

  let action, url;
  if (S.reviewMode === "open") { action = "both"; url = S.reviewLink; }
  else if (rating >= S.reviewThreshold) { action = "google"; url = S.reviewLink; }
  else { action = "feedback"; }

  await env.DB.prepare(`UPDATE ${s.table} SET review_rating=?1 WHERE id=?2`).bind(rating, b.id).run();
  // They answered — no more follow-ups, whatever they said.
  await stopReviewLadder(env, b.id, "rated");
  await env.DB.prepare("DELETE FROM reviews WHERE booking_id=?1").bind(b.id).run();
  await env.DB.prepare("INSERT INTO reviews (booking_id, rating, routed_to, created_at) VALUES (?1,?2,?3,?4)")
    .bind(b.id, rating, action, new Date().toISOString()).run();
  return { ok: true, action, url };
}

export async function handleReviewFeedback(env, S, body) {
  const tok = String(body.token || "");
  const fb = String(body.feedback || "").slice(0, 2000);
  if (!tok) return { ok: false };
  const s = await findReviewSubject(env, tok);
  const b = s && s.row;
  if (!b) return { ok: false };
  await env.DB.prepare("UPDATE reviews SET feedback=?1 WHERE booking_id=?2").bind(fb, b.id).run();
  if (fb) { try { await notifyOwnerLowRating(S, b, b.review_rating || "?", fb); } catch (e) { console.error("[review fb notify]", e); } }
  return { ok: true };
}
