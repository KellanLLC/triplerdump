// Standalone booking page at /book. Reads effective settings (S) so prices/caps
// reflect CMS edits. Clean checkout in the site's 2026-10 design (Barlow type,
// navy header, brand blue): four numbered steps, an order summary that stays in
// view, prices on every choice, and a missing-fields popup before submit. The
// custom dropdowns + calendar stay on purpose (the owner dislikes native pickers).
//
// ACCOUNT TYPE FIRST: the form asks Residential vs Commercial up top.
//  - Residential -> the service-aware SELF-SERVE booking (dumpster/trailer/junk/
//    binswitch) with size/length segmented selectors, a custom month-name calendar
//    picker, a 12-hour AM/PM time selector, live pricing, /api/geocode autocomplete,
//    combined terms+SMS-consent, and a confirmation screen. POSTs to /api/book.
//  - Commercial -> a SEPARATE streamlined "Request a quote" lead form (no pricing,
//    no day-range, no payment). POSTs to /api/book with account_type=commercial;
//    the backend stores an unpriced lead + alerts the owner, and we show a
//    "we'll reach out" screen.
import { ICON_SPRITE } from "./icons.js";
import { earliestDate } from "./booking.js";
import { fuelOn, fuelWords } from "./settings.js";
const escHtml = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function renderBookingPage(S, service) {
  const SERVICE_TYPES = ["dumpster", "trailer", "junk", "binswitch"];
  let svc = String(service || "").trim().toLowerCase();
  if (!SERVICE_TYPES.includes(svc)) svc = "dumpster";

  const svcLabels = {
    dumpster: "Dumpster Rental",
    trailer: (S.services && S.services.trailer && S.services.trailer.label) || "Dump Trailer Rental",
    junk: (S.services && S.services.junk && S.services.junk.label) || "Junk Removal",
    binswitch: (S.services && S.services.binswitch && S.services.binswitch.label) || "Bin Switch / Multi-Dump",
  };
  // Short labels for the compact service switcher (keeps the control on one/two rows).
  const svcShort = {
    dumpster: "Dumpster",
    trailer: "Dump Trailer",
    junk: "Junk Removal",
    binswitch: "Bin Switch",
  };

  // Pricing payload for the inline calculator (mirrors quoteService logic client-side).
  const tr = (S.services && S.services.trailer && S.services.trailer.pricing) || {};
  const jk = (S.services && S.services.junk && S.services.junk.pricing) || {};
  const bs = (S.services && S.services.binswitch && S.services.binswitch.pricing) || {};
  const pricing = {
    taxRate: S.taxRate,
    bins: Object.fromEntries(Object.entries(S.bins).filter(([, b]) => !b.hidden).map(([k, b]) => [k, { label: b.label, prices: b.prices }])),
    // add-ons for a dumpster (the console's Prices), in cents
    addons: (S.addons || []).filter((a) => a.on !== false).map((a) => ({ k: a.k, label: a.label, cents: Math.round(Number(a.cents)) })),
    // the fuel charge past the free miles (S.fuelMile); /api/fuel prices the address
    fuel: fuelOn(S) ? { free: Math.round(Number(S.fuelMile.free) || 0), words: fuelWords(S) } : null,
    tiers: Object.fromEntries(Object.entries(S.tiers).map(([k, t]) => [k, { label: t.label }])),
    services: {
      trailer: { dayRate_cents: tr.dayRate_cents || 20000, minDays: tr.minDays || 1, maxDays: tr.maxDays || 14, deposit_cents: tr.deposit_cents || 30000 },
      junk: { flat_cents: jk.flat_cents || 55000 },
      binswitch: { flat_cents: bs.flat_cents || 20000 },
    },
  };

  const money0 = (c) => "$" + (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));
  const g = S.googleReviews || { rating: 5, count: 0 };
  const binPhoto = { "15": "01_15yd_bin.png", "20": "02_20yd_bin_side.jpeg", "25": "03_25yd_bin_side.jpeg" };
  const binFor = { "15": "About 5 pickup loads. Garage cleanouts, yard waste, moving.", "20": "About 7 loads. Kitchens, flooring, estate cleanouts.", "25": "Roofing, construction, full-home cleanouts." };
  const minBin = Math.min(...Object.values(S.bins).filter((b) => !b.hidden).map((b) => b.prices["1-3"]).filter(Number.isFinite));
  const svcIcon = { dumpster: "i-bin", trailer: "i-trailer", junk: "i-couch", binswitch: "i-swap" };
  const svcPrice = {
    dumpster: "from " + money0(minBin),
    trailer: money0(pricing.services.trailer.dayRate_cents) + " / day",
    junk: money0(pricing.services.junk.flat_cents) + " flat",
    binswitch: money0(pricing.services.binswitch.flat_cents),
  };
  const svcCards = SERVICE_TYPES.map((t) =>
    '<label class="pick"><input type="radio" name="svc_choice" value="' + t + '"' + (t === svc ? " checked" : "") + '><span>' +
    '<svg width="22" height="22"><use href="#' + svcIcon[t] + '"/></svg><b>' + svcShort[t] + '</b><small>' + svcPrice[t] + '</small>' +
    '<svg class="ck" width="18" height="18"><use href="#i-check"/></svg></span></label>'
  ).join("");
  // Size = 3-across segmented cards; length = 2-across. "rental" sits on its own
  // muted line so "4-7 day" never crowds into "rental".
  const sizeRadios = Object.entries(S.bins).filter(([, b]) => !b.hidden).map(([size, b]) =>
    '<label class="opt size"><input type="radio" name="bin_size" value="' + size + '"><span class="card">' +
    (binPhoto[size] ? '<img src="/uploads/triplerdump_photos/triplerdump_photos/' + binPhoto[size] + '" alt="" loading="lazy">' : "") +
    (size === "20" ? '<span class="tag">Most rented</span>' : "") +
    '<span class="sz-b"><span class="sz-t"><b>' + b.label + '</b><em data-px="' + size + '">' + money0(b.prices["1-3"]) + '</em></span>' +
    ((b.blurb || binFor[size]) ? '<small>' + escHtml(b.blurb || binFor[size]) + '</small>' : "") + '</span>' +
    '<svg class="ck" width="18" height="18"><use href="#i-check"/></svg></span></label>'
  ).join("");
  const tierRadios = Object.entries(S.tiers).map(([t, v]) =>
    '<label class="opt"><input type="radio" name="rental_tier" value="' + t + '"><span class="card"><b>' + v.label + ' rental</b><em data-tier="' + t + '"></em></span></label>'
  ).join("");
  // Option lists for the custom dropdowns (built client-side from these arrays).
  const groundCdd = S.groundConditions.map((g) => ({ value: g, label: g }));
  const debrisCdd = [{ value: "", label: "Not sure / mixed" }].concat((S.debrisList || []).map((g) => ({ value: g, label: g })));
  const addonBoxes = pricing.addons.length
    ? '<fieldset style="margin:4px 0 8px"><legend>Add-ons (optional)</legend>' + pricing.addons.map((a) =>
        '<label class="inline"><input type="checkbox" data-addon="' + escHtml(a.k) + '"> ' + escHtml(a.label) + ' (+' + money0(a.cents) + ')</label>').join("") +
      '<input type="hidden" name="addons" value=""></fieldset>' : "";
  // the fuel charge up front, under the address; the page swaps in this address's charge once it's found
  const fz = pricing.fuel;
  const fuelHint = fz
    ? '<p class="hint" id="fuelmsg" aria-live="polite" style="margin:-6px 0 12px">Delivery&rsquo;s included within ' + fz.free + ' miles of our yard in West Haven. Farther out, we still come to you: ' +
      fz.words + ' (straight-line miles).</p>' : "";
  const debrisField = (S.debrisList || []).length
    ? '<label class="f">What&rsquo;s going in it?<span class="cdd" id="cdd-debris" data-cdd="debris">' +
      '<button type="button" class="cdd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="cdd-val"></span><span class="cdd-chev" aria-hidden="true"></span></button>' +
      '<input type="hidden" name="debris" value=""><ul class="cdd-pop" role="listbox" tabindex="-1" hidden></ul></span></label>' : "";
  // which days can be booked: first day (notice + same-day cutoff), closed days, the days he runs
  const RULES = { earliest: earliestDate(S), closed: Object.keys(S.closedDates || {}).filter((d) => S.closedDates[d]), run: S.runDays || [0, 1, 2, 3, 4, 5, 6] };
  const serviceCdd = SERVICE_TYPES.map((t) => ({ value: t, label: svcShort[t] }));
  const commIntCdd = [
    { value: "", label: "Not sure yet" },
    { value: "dumpster", label: "Dumpster" },
    { value: "trailer", label: "Dump Trailer" },
    { value: "junk", label: "Junk Removal" },
    { value: "binswitch", label: "Bin Switch" },
  ];

  const biz = S.business || {};
  const phone = biz.phone || "";
  const telHref = "tel:" + String(phone).replace(/[^\d+]/g, "");
  const attr = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  return '<!DOCTYPE html><html lang="en"><head>' +
'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>Book ' + svcLabels[svc] + ' - ' + biz.name + '</title>' +
// /book is a money page Google had never indexed: give it a description and
// one canonical URL per service (the ?canceled= / tracking variants fold in).
'<meta name="description" content="Book ' + attr(svcLabels[svc]) + ' online with ' + attr(biz.name || "") + ' in West Haven, Utah. Pick your dates, see the full price up front, pay securely. Serving Weber, Davis, Morgan and Salt Lake County.">' +
'<link rel="canonical" href="https://www.triplerdump.com/book' + (svc === "dumpster" ? "" : "?service=" + svc) + '">' +
'<meta name="theme-color" content="#141c2a">' +
'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
'<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,700;1,800&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet">' +
'<link rel="icon" href="/favicon.ico" sizes="any">' +
'<link rel="icon" href="/assets/favicon-32x32.png" type="image/png" sizes="32x32">' +
'<style>' +
':root{--blue:#116DFF;--blue-deep:#0d56c9;--blue-ink:#0b4fbf;--blue-soft:#eef4ff;--blue-line:#cfe0ff;--ink:#0f1726;--ink-2:#38445a;--ink-3:#5a667a;--line:#d3dae6;--line-2:rgba(15,23,38,.12);--bg:#f4f6f9;--card:#fff;--ok:#137a3b;--err:#c62828;--navy:#141c2a;--navy-2:#18223a;--sky:#bde9fb;--star:#fbbc05;--disp:"Barlow Condensed","Arial Narrow",sans-serif;--body:Barlow,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;--radius:10px;--radius-sm:8px}' +
'*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
'html{-webkit-text-size-adjust:100%}' +
'body{font-family:var(--body);font-size:16px;line-height:1.55;color:var(--ink);background:var(--bg);min-height:100vh;-webkit-font-smoothing:antialiased}' +
'img,svg{max-width:100%;display:block}a{color:var(--blue-ink)}' +
':focus-visible{outline:2.5px solid #3d8bff;outline-offset:2px}' +
'h1,h2,h3{font-family:var(--disp);font-weight:700;line-height:1.05}' +
'.bk-top{background:var(--navy);color:#f3f5f8}' +
'.bk-top__row{max-width:1180px;margin:0 auto;display:flex;align-items:center;gap:14px;padding:12px clamp(16px,5vw,56px);min-height:66px}' +
'.bk-mark{display:flex;align-items:center;gap:11px;text-decoration:none;color:#f3f5f8}' +
'.bk-mark img{height:40px;width:auto}' +
'.bk-wm{font-family:var(--disp);font-weight:700;font-size:1.24rem;line-height:1;letter-spacing:.02em;text-transform:uppercase}' +
'.bk-wm b{display:block;margin-top:3px;font-size:.62em;letter-spacing:.22em;color:var(--sky)}' +
'.bk-back{margin-left:auto;display:inline-flex;align-items:center;gap:7px;font-size:.92rem;color:#cfd6e2;text-decoration:none}' +
'.bk-back:hover{color:#fff}' +
'.bk-tel{display:inline-flex;align-items:center;gap:7px;font-family:var(--disp);font-weight:700;font-size:1.05rem;color:#fff;text-decoration:none;padding-left:16px;border-left:1px solid rgba(243,245,248,.15)}' +
'@media(max-width:560px){.bk-tel{display:none}}' +
'.tape{height:6px;background:repeating-linear-gradient(135deg,#fff 0 14px,#d42a20 14px 28px)}' +
'.bk-head{max-width:1180px;margin:0 auto;padding:clamp(26px,4vw,44px) clamp(16px,5vw,56px) 18px}' +
'.kicker{font-family:var(--disp);font-weight:700;font-size:.86rem;letter-spacing:.19em;text-transform:uppercase;color:var(--blue-ink);margin-bottom:8px}' +
'.bk-head h1{font-size:clamp(2.1rem,1.4rem + 2.6vw,3.2rem);letter-spacing:-.006em}' +
'.bk-head .lede{margin-top:10px;color:var(--ink-2);max-width:56ch}' +
'.bk-head .lede a{font-weight:700;text-decoration:none;white-space:nowrap}' +
'.bk-proof{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:14px;font-size:.92rem;color:var(--ink-2)}' +
'.bk-proof span{display:inline-flex;align-items:center;gap:6px}' +
'.bk-proof svg{color:var(--blue-ink)}' +
'.bk-proof .stars,.bk-proof .stars svg{color:var(--star)}' +
'.stars{display:inline-flex;gap:2px}' +
'.bk-proof b{color:var(--ink)}' +
'.bk{max-width:1180px;margin:0 auto;padding:0 clamp(16px,5vw,56px) 60px;display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:28px;align-items:start}' +
'@media(max-width:980px){.bk{grid-template-columns:1fr}}' +
'form{background:none;border:0;padding:0}' +
'fieldset{border:0;padding:0;margin:0 0 14px;min-width:0}' +
'legend,.lbl{display:block;font-weight:600;font-size:.9rem;margin:0 0 6px;padding:0;color:var(--ink)}' +
'.acct{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;background:#e6ebf2;padding:6px;border-radius:var(--radius);margin:0 0 16px}' +
'.acct .ac-card{position:relative;display:block;cursor:pointer}' +
'.acct input{position:absolute;opacity:0;width:0;height:0}' +
'.acct .ac-card .box{display:flex;align-items:flex-start;gap:10px;height:100%;border-radius:7px;padding:10px 12px;color:var(--ink-2)}' +
'.acct .ac-card .box svg{flex:none;margin-top:2px}' +
'.acct .ac-card .t{display:block;font-family:var(--disp);font-weight:700;font-size:1.1rem;line-height:1.1;color:var(--ink)}' +
'.acct .ac-card .d{display:block;font-size:.8rem;line-height:1.3;margin-top:2px}' +
'.acct input:checked+.box{background:#fff;box-shadow:0 1px 3px rgba(15,23,38,.12)}' +
'.acct input:checked+.box svg{color:var(--blue)}' +
'.acct input:focus-visible+.box{outline:2.5px solid #3d8bff}' +
'.step-c{background:var(--card);border:1px solid var(--line-2);border-radius:var(--radius);padding:clamp(18px,2.4vw,26px);margin-bottom:14px}' +
'.step-c__h{display:flex;align-items:center;gap:12px;margin-bottom:16px}' +
'.step-c__n{width:30px;height:30px;border-radius:50%;background:var(--blue);color:#fff;display:grid;place-items:center;font-family:var(--disp);font-weight:700;flex:none}' +
'.step-c__h h2{font-size:1.5rem}' +
'.step-c__h p{margin-top:2px;font-size:.86rem;color:var(--ink-3)}' +
'.svc-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}' +
'@media(max-width:640px){.svc-tabs{grid-template-columns:1fr 1fr}}' +
'.pick{position:relative;cursor:pointer;display:block}' +
'.pick input{position:absolute;opacity:0;width:0;height:0}' +
'.pick>span{display:flex;flex-direction:column;gap:4px;height:100%;border:1.5px solid var(--line);border-radius:9px;padding:12px;background:#fff;transition:border-color .2s,box-shadow .2s}' +
'.pick:hover>span{border-color:#9fb3cf}' +
'.pick input:checked+span{border-color:var(--blue);box-shadow:0 0 0 3px rgba(17,109,255,.14)}' +
'.pick input:focus-visible+span{outline:2.5px solid #3d8bff;outline-offset:2px}' +
'.pick svg{color:var(--blue-ink)}' +
'.pick b{font-family:var(--disp);font-size:1.12rem;line-height:1.1}' +
'.pick small{font-size:.8rem;color:var(--ink-3)}' +
'.ck{position:absolute;right:9px;top:9px;color:var(--blue);opacity:0;transition:opacity .2s}' +
'input:checked+span .ck{opacity:1}' +
'.opts{display:grid;gap:10px}.opts.sizes{grid-template-columns:repeat(3,1fr)}.opts.lengths{grid-template-columns:repeat(2,1fr)}' +
'@media(max-width:640px){.opts.sizes{grid-template-columns:1fr}}' +
'.opt{position:relative;min-width:0;display:block;cursor:pointer}' +
'.opt input{position:absolute;opacity:0;width:0;height:0}' +
'.opt .card{display:flex;align-items:center;justify-content:space-between;gap:8px;height:100%;border:1.5px solid var(--line);border-radius:9px;padding:12px 14px;background:#fff;transition:border-color .2s,box-shadow .2s;position:relative}' +
'.opt .card b{font-family:var(--disp);font-size:1.15rem;line-height:1.1}' +
'.opt .card em{font-style:normal;font-family:var(--disp);font-weight:700;font-size:1.2rem;color:var(--ink)}' +
'.opt:hover .card{border-color:#9fb3cf}' +
'.opt input:checked+.card{border-color:var(--blue);box-shadow:0 0 0 3px rgba(17,109,255,.14)}' +
'.opt input:focus-visible+.card{outline:2.5px solid #3d8bff;outline-offset:2px}' +
'.opt.size .card{flex-direction:column;align-items:stretch;justify-content:flex-start;padding:0;overflow:hidden;gap:0}' +
'.opt.size img{width:100%;aspect-ratio:16/10;object-fit:cover;background:#e6ebf2}' +
'.opt.size .sz-b{padding:10px 12px 12px;display:flex;flex-direction:column;gap:2px}' +
'.opt.size .sz-t{display:flex;align-items:baseline;justify-content:space-between;gap:8px}' +
'.opt.size .sz-t b{font-size:1.5rem}' +
'.opt.size small{font-size:.8rem;color:var(--ink-3);line-height:1.35}' +
'.opt.size .tag{position:absolute;left:8px;top:8px;background:var(--blue);color:#fff;font-family:var(--disp);font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;padding:3px 7px;border-radius:4px}' +
'.opt.size .ck{background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(15,23,38,.25)}' +
'@media(max-width:640px){.opt.size .card{flex-direction:row}.opt.size img{width:120px;aspect-ratio:auto;flex:none}.opt.size .sz-b{flex:1}.opt.size .sz-t{padding-right:24px}}' +
'.hint,.mut{font-size:.82rem;color:var(--ink-3);margin-top:5px;font-weight:400}' +
'.note{display:flex;gap:10px;align-items:flex-start;background:var(--blue-soft);border:1px solid var(--blue-line);border-radius:8px;padding:11px 12px;font-size:.9rem;color:#23406f;margin-top:4px}' +
'.note svg{flex:none;margin-top:2px;color:var(--blue-ink)}' +
'label.f{display:block;margin:0 0 14px;font-weight:600;font-size:.9rem;color:var(--ink)}' +
'.row{display:grid;grid-template-columns:1fr 1fr;gap:14px 12px;margin-bottom:14px}' +
'.row>label.f{margin-bottom:0}' +
'@media(max-width:560px){.row{grid-template-columns:1fr}}' +
'input[type=text],input[type=tel],input[type=email],input[type=number],textarea{width:100%;margin-top:6px;padding:12px 13px;min-height:48px;border:1.5px solid #cdd5e1;border-radius:8px;font:inherit;font-size:1rem;font-weight:400;background:#fff;color:var(--ink);-webkit-appearance:none;appearance:none}' +
'input::placeholder,textarea::placeholder{color:var(--ink-3);opacity:.75}' +
'input:focus,textarea:focus{border-color:var(--blue);outline:none;box-shadow:0 0 0 3px rgba(17,109,255,.16)}' +
'textarea{min-height:84px;resize:vertical}' +
'.inline{display:inline-flex;align-items:center;gap:8px;font-weight:500;font-size:.95rem;margin:0 18px 8px 0;min-height:30px;cursor:pointer;color:var(--ink)}' +
'.inline input,.terms input{width:20px;height:20px;min-height:0;flex-shrink:0;accent-color:var(--blue);cursor:pointer;margin:0}' +
'.cdd{position:relative;margin-top:6px;display:block}' +
'.cdd-btn{width:100%;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:12px 13px;border:1.5px solid #cdd5e1;border-radius:8px;background:#fff;color:var(--ink);font:inherit;font-size:1rem;font-weight:400;cursor:pointer;text-align:left;box-shadow:none}' +
'.cdd-btn:hover{border-color:#9fb3cf;background:#fff;box-shadow:none}' +
'.cdd-btn.is-open{border-color:var(--blue);box-shadow:0 0 0 3px rgba(17,109,255,.16)}' +
'.cdd-btn .cdd-val{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
'.cdd-btn .cdd-val.ph{color:var(--ink-3)}' +
'.cdd-chev{flex-shrink:0;width:.55rem;height:.55rem;border-right:2px solid var(--ink-3);border-bottom:2px solid var(--ink-3);transform:rotate(45deg);transition:transform .15s;margin-top:-3px}' +
'.cdd-btn.is-open .cdd-chev{transform:rotate(-135deg);margin-top:2px}' +
'.cdd-pop{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:35;background:#fff;border:1px solid #cdd5e1;border-radius:8px;box-shadow:0 12px 30px rgba(15,23,38,.16);max-height:16rem;overflow-y:auto;list-style:none;padding:4px}' +
'.cdd-pop[hidden]{display:none}' +
'.cdd-opt{display:flex;align-items:center;min-height:44px;padding:.5rem .7rem;border-radius:6px;cursor:pointer;font-size:.98rem;color:var(--ink)}' +
'.cdd-opt:hover,.cdd-opt.cdd-active{background:var(--blue-soft)}' +
'.cdd-opt[aria-selected="true"]{color:var(--blue-ink);font-weight:700;background:var(--blue-soft)}' +
'.picker{position:relative;margin-top:6px;display:block}' +
'.picker-btn{width:100%;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:12px 13px;border:1.5px solid #cdd5e1;border-radius:8px;background:#fff;color:var(--ink);font:inherit;font-size:1rem;font-weight:400;cursor:pointer;text-align:left;box-shadow:none}' +
'.picker-btn:hover{border-color:#9fb3cf;background:#fff;box-shadow:none}' +
'.picker-btn.is-open{border-color:var(--blue);box-shadow:0 0 0 3px rgba(17,109,255,.16)}' +
'.picker-btn .ph{color:var(--ink-3)}' +
'.picker-btn .cae{flex-shrink:0;color:var(--blue-ink)}' +
'.cal{position:absolute;left:0;top:calc(100% + 4px);z-index:40;width:18rem;max-width:calc(100vw - 32px);background:#fff;border:1px solid #cdd5e1;border-radius:10px;box-shadow:0 14px 36px rgba(15,23,38,.2);padding:10px}' +
'.cal[hidden]{display:none}' +
'.cal-top{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px}' +
'.cal-title{font-family:var(--disp);font-weight:700;font-size:1.1rem;color:var(--ink)}' +
'.cal-nav{width:34px;height:34px;min-height:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:7px;background:#fff;color:var(--ink);font-size:16px;cursor:pointer;padding:0;box-shadow:none}' +
'.cal-nav:hover:not(:disabled){border-color:var(--blue);color:var(--blue);background:#fff}' +
'.cal-nav:disabled{opacity:.35;cursor:default}' +
'.cal-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}' +
'.cal-dow span{text-align:center;font-size:11px;font-weight:700;color:var(--ink-3);padding:2px 0}' +
'.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}' +
'.cal-cell{aspect-ratio:1/1;min-height:32px;display:flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:transparent;color:var(--ink);font:inherit;font-size:.9rem;cursor:pointer;padding:0;box-shadow:none}' +
'.cal-cell.empty{visibility:hidden;cursor:default}' +
'.cal-cell:hover:not(:disabled){background:var(--blue-soft)}' +
'.cal-cell:disabled{color:#c2ccd9;cursor:default}' +
'.cal-cell.sel{background:var(--blue);color:#fff;font-weight:700}' +
'.cal-cell.today:not(.sel){box-shadow:0 0 0 1.5px var(--blue-line) inset}' +
'.ac-wrap{position:relative;display:block}' +
'.ac-list{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:30;background:#fff;border:1px solid #cdd5e1;border-radius:8px;box-shadow:0 12px 30px rgba(15,23,38,.16);max-height:16rem;overflow-y:auto;list-style:none;padding:4px}' +
'.ac-list[hidden]{display:none}' +
'.ac-item{padding:10px;border-radius:6px;cursor:pointer;font-size:.95rem;font-weight:400;color:var(--ink);line-height:1.3}' +
'.ac-item:hover,.ac-item.ac-active{background:var(--blue-soft)}' +
'.ac-ok{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:.84rem;color:var(--ok);font-weight:600}' +
'.ac-ok[hidden]{display:none}' +
'.promo-a{display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:.92rem;font-weight:600;color:var(--blue-ink);background:none;border:0;padding:0;min-height:0;width:auto;box-shadow:none;cursor:pointer}' +
'.promo-a:hover{text-decoration:underline;background:none;box-shadow:none}' +
'.terms{display:flex;gap:10px;align-items:flex-start;font-size:.94rem;color:var(--ink-2);margin:6px 0 4px;cursor:pointer}' +
'.terms a{color:var(--blue-ink);font-weight:600}' +
'.cardnote{margin:0 0 14px 30px}' +
'.leadnote{font-size:.92rem;color:var(--ink-2);background:var(--blue-soft);border:1px solid var(--blue-line);border-radius:8px;padding:11px 12px;margin:0 0 14px}' +
'button{font-family:inherit}' +
'#submitBtn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;font-family:var(--disp);font-size:clamp(1.2rem,1rem + .6vw,1.42rem);font-weight:700;letter-spacing:.02em;background:var(--blue);color:#fff;border:0;border-radius:4px;min-height:58px;padding:14px 18px;cursor:pointer;transition:background-color .2s}' +
'#submitBtn:hover{background:var(--blue-deep)}' +
'#submitBtn:disabled{opacity:.6;cursor:default}' +
'.secure{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 18px;font-size:.84rem;color:var(--ink-3);margin:12px 0 0}' +
'.secure span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}' +
'.out{margin-top:14px;padding:12px 14px;border-radius:8px;font-size:.95rem;background:#fff;border:1px solid var(--line-2)}' +
'.out.err{background:#fff5f4;border:1px solid #f3c7c3;color:#a31515}' +
'.hidden{display:none!important}' +
'.sum{position:sticky;top:18px}' +
'@media(max-width:980px){.sum{position:static}}' +
'.sum__card{background:#fff;border:1px solid var(--line-2);border-radius:10px;overflow:hidden}' +
'.sum__h{background:var(--navy-2);color:#fff;padding:16px 18px}' +
'.sum__h h2{font-size:1.35rem}' +
'.sum__b{padding:16px 18px}' +
'.sumbox{display:grid;gap:7px}' +
'.sumrow{display:flex;justify-content:space-between;gap:12px;font-size:.95rem;color:var(--ink-2)}' +
'.sumrow span:last-child{font-variant-numeric:tabular-nums;color:var(--ink)}' +
'.sumrow.tot{align-items:baseline;border-top:1px solid var(--line-2);margin-top:6px;padding-top:12px;color:var(--ink)}' +
'.sumrow.tot span:first-child{font-family:var(--disp);font-weight:700;font-size:1.3rem}' +
'.sumrow.tot span:last-child{font-family:var(--disp);font-weight:800;font-size:2rem}' +
'#sumdiscrow span:last-child{color:var(--ok)}' +
'.incl{list-style:none;margin:14px 0 0;padding:12px 0 0;border-top:1px solid var(--line-2);display:grid;gap:7px;font-size:.88rem;color:var(--ink-2)}' +
'.incl li{display:flex;gap:8px;align-items:flex-start}' +
'.incl svg{color:var(--ok);flex:none;margin-top:2px}' +
'.sum__trust{margin-top:12px;background:#fff;border:1px solid var(--line-2);border-radius:10px;padding:14px 16px;font-size:.9rem}' +
'.sum__trust .stars{color:var(--star);vertical-align:-2px}' +
'.sum__trust p{margin-top:6px;color:var(--ink-2);line-height:1.5}' +
'.sum__trust cite{display:block;margin-top:6px;font-style:normal;font-size:.8rem;color:var(--ink-3)}' +
'.sum__help{margin-top:12px;font-size:.88rem;color:var(--ink-2);text-align:center}' +
'.sum__help a{font-weight:700;text-decoration:none}' +
'.paybar{display:none}' +
'@media(max-width:980px){.paybar{display:flex;align-items:center;gap:12px;position:fixed;left:0;right:0;bottom:0;z-index:90;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid var(--line-2);box-shadow:0 -6px 20px rgba(15,23,38,.08)}.paybar div{flex:1;min-width:0}.paybar small{display:block;font-size:.76rem;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.paybar b{font-family:var(--disp);font-size:1.5rem;font-variant-numeric:tabular-nums}body.has-paybar{padding-bottom:84px}}' +
'.paybar button{width:auto;min-height:48px;padding:12px 18px;border:0;border-radius:4px;background:var(--blue);color:#fff;font-family:var(--disp);font-weight:700;font-size:1.08rem;cursor:pointer}' +
'.is-missing.cdd-btn,.is-missing.picker-btn,input.is-missing,textarea.is-missing{border-color:var(--err)!important;box-shadow:0 0 0 3px rgba(198,40,40,.12)!important}' +
'fieldset.is-missing>legend,label.terms.is-missing{color:#b3261e}' +
'fieldset.is-missing .opts .card{border-color:#e6a19b}' +
'.miss{position:fixed;inset:0;z-index:300;background:rgba(9,14,22,.55);display:none;align-items:center;justify-content:center;padding:20px}' +
'.miss.on{display:flex}' +
'.miss__in{background:#fff;border-radius:12px;max-width:420px;width:100%;padding:24px}' +
'.miss__in h3{font-size:1.6rem;margin-bottom:8px}' +
'.miss__in p{color:var(--ink-2);margin-bottom:14px}' +
'.miss__list{list-style:none;margin:0 0 18px;padding:0;display:grid;gap:6px}' +
'.miss__list button{width:100%;display:flex;align-items:center;gap:10px;text-align:left;font:inherit;font-size:.96rem;color:var(--ink);background:#fff5f4;border:1px solid #f3c7c3;border-radius:8px;padding:10px 12px;cursor:pointer;min-height:0}' +
'.miss__list button::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--err);flex:none}' +
'.miss__list button:hover{border-color:var(--err)}' +
'.miss__acts{display:flex;gap:10px}' +
'.miss__acts button{flex:1;min-height:48px;border-radius:4px;font-family:var(--disp);font-weight:700;font-size:1.08rem;cursor:pointer;border:0;background:var(--blue);color:#fff}' +
'.miss__acts button.ghost{background:#fff;color:var(--ink);border:1.5px solid rgba(15,23,38,.28)}' +
'.confirm{background:#fff;border:1px solid var(--line-2);border-radius:10px;overflow:hidden}' +
'.confirm-head{background:var(--navy-2);color:#fff;padding:26px 18px;text-align:center}' +
'.confirm-head .check{width:52px;height:52px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:26px;line-height:1}' +
'.confirm-head h2{font-size:2rem;color:#fff}' +
'.confirm-head p{font-size:.95rem;opacity:.94;margin-top:.3rem}' +
'.refbox{display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:14px}' +
'.refbox .reflabel{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.85}' +
'.refbox .ref{font-weight:800;font-size:17px;letter-spacing:.04em;background:rgba(255,255,255,.12);padding:.2rem .65rem;border-radius:6px}' +
'.confirm-body{padding:20px 18px}' +
'.confirm-body h3{font-size:1.2rem;margin:0 0 8px;color:var(--ink)}' +
'.recap{list-style:none;margin:0 0 18px}' +
'.recap li{display:flex;justify-content:space-between;gap:12px;padding:.5rem 0;border-top:1px solid var(--line-2);font-size:.95rem}' +
'.recap li:first-child{border-top:0}' +
'.recap .k{color:var(--ink-3)}.recap .v{text-align:right;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}' +
'.recap li.tot .v{font-weight:800;font-size:1.05rem;color:var(--blue-ink)}' +
'.next{background:var(--blue-soft);border:1px solid var(--blue-line);border-radius:8px;padding:12px 14px;margin-bottom:18px}' +
'.next ul{margin:.2rem 0 0;padding-left:1.1rem}.next li{font-size:.92rem;color:var(--ink-2);margin:.35rem 0}' +
'.next li strong{color:var(--ink);font-weight:600}' +
'.cal-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}' +
'.btn2{flex:1 1 11rem;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:46px;font-weight:700;font-size:.95rem;text-decoration:none;border-radius:4px;padding:.6rem 1rem;border:1.5px solid var(--blue);color:var(--blue-ink);background:#fff}' +
'.btn2:hover{background:var(--blue);color:#fff}' +
'.confirm-foot{font-size:.92rem;color:var(--ink-2);text-align:center}' +
'.confirm-foot a{font-weight:700;white-space:nowrap}' +
'body.is-done .sum,body.is-done .paybar{display:none!important}' +
'@media(prefers-reduced-motion:reduce){*{transition-duration:1ms!important;animation-duration:1ms!important}}' +
'</style></head><body>' +
'<header class="bk-top"><div class="bk-top__row">' +
'<a class="bk-mark" href="/" aria-label="' + attr(biz.name) + ' - home"><img src="/assets/triple-r-dump-icon.webp" alt="" width="40" height="40"><span class="bk-wm">' + attr(biz.name) + '<b>West Haven, Utah</b></span></a>' +
'<a class="bk-back" href="/"><svg width="16" height="16"><use href="#i-back"/></svg>Back to site</a>' +
'<a class="bk-tel" href="' + telHref + '"><svg width="17" height="17"><use href="#i-phone"/></svg>' + phone + '</a>' +
'</div></header><div class="tape" aria-hidden="true"></div>' +
ICON_SPRITE +
'<section class="bk-head"><p class="kicker">Book online</p>' +
'<h1 id="pagetitle">Book Your ' + svcLabels[svc] + '</h1>' +
'<p class="lede">Pick what you need, a date and an address. You&rsquo;ll see the full price, tax included, before you pay. Questions? <a href="' + telHref + '">' + phone + '</a></p>' +
(g.count ? '<div class="bk-proof"><span><span class="stars">' + '<svg width="15" height="15"><use href="#i-star"/></svg>'.repeat(5) + '</span><b>' + Number(g.rating).toFixed(1) + '</b> from ' + g.count + ' Google reviews</span>' : '<div class="bk-proof">') +
'<span><svg width="16" height="16"><use href="#i-check"/></svg>Dump fee included</span>' +
'<span><svg width="16" height="16"><use href="#i-lock"/></svg>Secure checkout by Stripe</span></div>' +
'</section>' +
'<main class="bk"><div class="bk-main">' +
// NOTE: form is novalidate - the missing-fields popup is UX only; the server
// (booking.js validate()) is the source of truth for validation.
'<form id="f" novalidate>' +
// ----- Account type FIRST (drives the whole form) -----
'<div class="acct" role="radiogroup" aria-label="Who is this for?">' +
'<label class="ac-card"><input type="radio" name="account_type" value="residential" checked><span class="box"><svg width="22" height="22"><use href="#i-house"/></svg><span><span class="t">Residential</span><span class="d">Book &amp; pay online</span></span></span></label>' +
'<label class="ac-card"><input type="radio" name="account_type" value="commercial"><span class="box"><svg width="22" height="22"><use href="#i-buildings"/></svg><span><span class="t">Commercial</span><span class="d">Request a quote</span></span></span></label>' +
'</div>' +
// =================== RESIDENTIAL (self-serve booking) ===================
'<div id="resi">' +
'<section class="step-c"><div class="step-c__h"><span class="step-c__n">1</span><div><h2>Your bin</h2><p>What you need and for how long.</p></div></div>' +
'<input type="hidden" name="service_type" value="' + svc + '">' +
'<div class="svc-tabs" role="radiogroup" aria-label="Service">' + svcCards + '</div>' +
'<div data-svc="dumpster">' +
'<fieldset id="fs-size"><legend>Bin size</legend><div class="opts sizes">' + sizeRadios + '</div>' +
'<p class="hint">Not sure? Most kitchen or bathroom remodels fit a 20. Call ' + phone + ' and we&rsquo;ll size it with you.</p></fieldset>' +
'<fieldset id="fs-tier"><legend>Rental length</legend><div class="opts lengths">' + tierRadios + '</div>' +
'<p class="hint">Need it longer? Extra days are ' + money0((S.fees && S.fees.extensionDay) || 5000) + ' each; call before pickup to extend.</p></fieldset>' +
'</div>' +
'<div data-svc="trailer" class="hidden">' +
'<label class="f">Rental days<input type="number" name="rental_days" min="1" max="14" step="1" value="1"></label>' +
'<div class="note"><svg width="18" height="18"><use href="#i-info"/></svg><span>' + money0(pricing.services.trailer.dayRate_cents) + ' a day, ' + pricing.services.trailer.minDays + ' to ' + pricing.services.trailer.maxDays + ' days, plus a ' + money0(pricing.services.trailer.deposit_cents) + ' refundable deposit. You pick it up at our yard in West Haven.</span></div>' +
'</div>' +
'<div data-svc="junk" class="hidden"><div class="note"><svg width="18" height="18"><use href="#i-info"/></svg><span>Full service: we load it and haul it. Junk removal runs on <b>weekends only</b>, so pick a Saturday or Sunday below.</span></div></div>' +
'<div data-svc="binswitch" class="hidden">' +
'<label class="f">Your current booking ref (optional)<input type="text" name="existing_ref" placeholder="TRD-XXXXXX"></label>' +
'<div class="note"><svg width="18" height="18"><use href="#i-info"/></svg><span>We haul the full bin and drop an empty one in the same trip.</span></div>' +
'</div>' +
'</section>' +
'<section class="step-c"><div class="step-c__h"><span class="step-c__n">2</span><div><h2>When &amp; where</h2><p>The day it arrives and where it goes.</p></div></div>' +
'<div class="row">' +
'<label class="f">Delivery date<span class="picker" id="datepick">' +
'<button type="button" class="picker-btn" id="dateBtn" aria-haspopup="dialog" aria-expanded="false"><span id="dateBtnText" class="ph">Select a date</span><svg class="cae" width="18" height="18" aria-hidden="true"><use href="#i-cal"/></svg></button>' +
'<input type="hidden" name="delivery_date" id="deliveryDate">' +
'<div class="cal" id="calPop" role="dialog" aria-label="Choose delivery date" hidden>' +
'<div class="cal-top"><button type="button" class="cal-nav" id="calPrev" aria-label="Previous month">&#8249;</button>' +
'<span class="cal-title" id="calTitle"></span>' +
'<button type="button" class="cal-nav" id="calNext" aria-label="Next month">&#8250;</button></div>' +
'<div class="cal-dow"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>' +
'<div class="cal-grid" id="calGrid"></div></div></span></label>' +
'<label class="f">When in the day? (optional)<span class="cdd" id="cdd-time" data-cdd="time">' +
'<button type="button" class="cdd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="cdd-val"></span><span class="cdd-chev" aria-hidden="true"></span></button>' +
'<input type="hidden" name="delivery_time" value="">' +
'<ul class="cdd-pop" role="listbox" tabindex="-1" hidden></ul></span><span class="hint" style="display:block">A preference, not a set appointment.</span></label>' +
'</div>' +
'<p class="mut" id="weekendnote" style="display:none;margin:-6px 0 12px">Junk removal runs weekends only - pick a Saturday or Sunday.</p>' +
'<label class="f" id="dropwrap">Drop-off address<span class="ac-wrap"><input type="text" name="address" placeholder="Start typing: 1234 S Main St, Roy" autocomplete="off">' +
'<ul class="ac-list" id="ac-address" role="listbox" hidden></ul></span><span class="ac-ok" data-ok-for="address" hidden><svg width="15" height="15"><use href="#i-check"/></svg>Address found on the map</span></label>' +
fuelHint +
'<div data-svc="dumpster">' +
'<label class="inline"><input type="checkbox" id="samepick" checked> Pick-up address is the same as drop-off</label>' +
'<label class="f hidden" id="pickwrap">Pick-up address<span class="ac-wrap"><input type="text" name="pickup_address" placeholder="Start typing the pick-up address" autocomplete="off">' +
'<ul class="ac-list" id="ac-pickup" role="listbox" hidden></ul></span><span class="ac-ok" data-ok-for="pickup_address" hidden><svg width="15" height="15"><use href="#i-check"/></svg>Address found on the map</span></label>' +
'<div class="row">' +
'<label class="f">Where will the bin sit?<span class="cdd" id="cdd-ground" data-cdd="ground">' +
'<button type="button" class="cdd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="cdd-val"></span><span class="cdd-chev" aria-hidden="true"></span></button>' +
'<input type="hidden" name="ground_condition" value="">' +
'<ul class="cdd-pop" role="listbox" tabindex="-1" hidden></ul></span></label>' +
'<fieldset id="fs-permit" style="margin:0"><legend>Permit or HOA approval needed?</legend>' +
'<label class="inline"><input type="radio" name="permit_needed" value="yes"> Yes</label>' +
'<label class="inline"><input type="radio" name="permit_needed" value="no"> No</label>' +
'<label class="f hidden" id="permwrap" style="margin-top:8px">Can you get it before the bin arrives?<input type="text" name="permit_obtainable"></label></fieldset>' +
'</div>' +
'<p class="hint" style="margin-top:-4px">On the street, some cities want a permit. On a driveway we can set it on boards to protect the concrete; mention it below.</p>' +
debrisField + addonBoxes +
'</div>' +
'</section>' +
'<section class="step-c"><div class="step-c__h"><span class="step-c__n">3</span><div><h2>Your details</h2><p>For the confirmation text and the driver.</p></div></div>' +
'<div class="row"><label class="f">First name<input type="text" name="first_name" autocomplete="given-name"></label><label class="f">Last name<input type="text" name="last_name" autocomplete="family-name"></label></div>' +
'<div class="row"><label class="f">Mobile phone<input type="tel" name="phone" autocomplete="tel"><span class="hint" style="display:block">We text your confirmation and a reminder before pickup.</span></label><label class="f">Email<input type="email" name="email" autocomplete="email"></label></div>' +
'<label class="f">Anything we should know? (optional)<textarea name="message" placeholder="Gate code, which side of the driveway, what you&rsquo;re throwing out..."></textarea></label>' +
'</section>' +
'<section class="step-c"><div class="step-c__h"><span class="step-c__n">4</span><div><h2>Review &amp; pay</h2><p>Pay by card through Stripe.</p></div></div>' +
// No placeholder on purpose: showing an example code ("MILITARY10") hands
// every visitor a string that is probably a REAL working discount.
'<button type="button" class="promo-a" id="promoA"><svg width="16" height="16"><use href="#i-tag"/></svg>Have a promo code?</button>' +
'<label class="f hidden" id="promoW" style="max-width:300px;margin-top:8px">Promo code<input type="text" name="promo_code" autocomplete="off" autocapitalize="characters" spellcheck="false"><span class="mut" id="promomsg" style="display:block;margin-top:3px"></span></label>' +
'<label class="terms" id="termsL" style="margin-top:14px"><input type="checkbox" name="agreed_terms"> <span>I agree to the <a href="/terms" target="_blank" rel="noopener">terms, return &amp; cancellation policies</a>, and to receiving service texts about my booking. Reply STOP to opt out.</span></label>' +
'<p class="hint cardnote">Your card is kept on file for extra days or overweight charges, as the terms explain.</p>' +
'</section>' +
'</div>' +
// =================== COMMERCIAL (request a quote lead) ===================
'<div id="comm" class="hidden"><section class="step-c"><div class="step-c__h"><span class="step-c__n">1</span><div><h2>About the job</h2><p>No payment now. Joseph calls you back.</p></div></div>' +
'<p class="leadnote">Tell us about the job and Joseph will reach out to set up your account and pricing.</p>' +
'<div class="row"><label class="f">Company<input type="text" name="company_c" placeholder="Company / business name"></label>' +
'<label class="f">Contact name<input type="text" name="contact_name"></label></div>' +
'<div class="row"><label class="f">Phone<input type="tel" name="phone_c"></label><label class="f">Email<input type="email" name="email_c"></label></div>' +
'<label class="f">What do you need? (optional)<span class="cdd" id="cdd-comm" data-cdd="comm">' +
'<button type="button" class="cdd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="cdd-val"></span><span class="cdd-chev" aria-hidden="true"></span></button>' +
'<input type="hidden" name="service_interest" value="">' +
'<ul class="cdd-pop" role="listbox" tabindex="-1" hidden></ul></span></label>' +
'<label class="f">Job site address<span class="ac-wrap"><input type="text" name="address_c" placeholder="Start typing the job site address" autocomplete="off">' +
'<ul class="ac-list" id="ac-address-c" role="listbox" hidden></ul></span><span class="ac-ok" data-ok-for="address_c" hidden><svg width="15" height="15"><use href="#i-check"/></svg>Address found on the map</span></label>' +
'<label class="f">Timeframe / how long you need it<input type="text" name="timeframe" placeholder="e.g. ASAP, about 2 weeks next month"></label>' +
'<label class="f">Details<textarea name="details" placeholder="What you are clearing, size of job, any access notes..."></textarea></label>' +
'<label class="terms" id="termsC"><input type="checkbox" name="agreed_terms_c"> <span>I agree to the <a href="/terms" target="_blank" rel="noopener">terms</a> and to be contacted about my request, including by text. Reply STOP to opt out.</span></label>' +
'</section></div>' +
// Honeypot: off-screen, not tabbable, hidden from AT. Real customers never fill
// it; scripted spam fills every input it finds. Server rejects when non-empty.
'<div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">' +
'<label>Leave this field empty<input type="text" name="trd_hp" tabindex="-1" autocomplete="off"></label></div>' +
'<button type="submit" id="submitBtn">Continue to secure payment</button>' +
'<p class="secure" id="secureLine"><span><svg width="15" height="15"><use href="#i-lock"/></svg>Secure checkout by Stripe</span></p>' +
'</form>' +
'<div id="out" class="out hidden" role="alert"></div>' +
'<div id="confirm" class="hidden"></div>' +
'</div>' +
'<aside class="sum" id="sumAside" aria-label="Order summary"><div class="sum__card"><div class="sum__h"><h2>Your order</h2></div><div class="sum__b">' +
'<div class="sumbox"><div class="sumrow"><span id="sumlabel">Select options</span><span id="sumsub">-</span></div>' +
'<div class="sumrow" id="sumfuelrow" style="display:none"><span id="sumfuellabel">Fuel charge</span><span id="sumfuel">-</span></div>' +
'<div class="sumrow" id="sumdiscrow" style="display:none"><span id="sumdisclabel">Discount</span><span id="sumdisc">-</span></div>' +
'<div class="sumrow"><span>Utah sales tax</span><span id="sumtax">-</span></div>' +
'<div class="sumrow" id="sumdeprow" style="display:none"><span>Refundable deposit</span><span id="sumdep">-</span></div>' +
'<div class="sumrow tot"><span>Total</span><span id="sumtot">-</span></div></div>' +
'<ul class="incl"><li><svg width="16" height="16"><use href="#i-check"/></svg>Delivery and pickup</li><li><svg width="16" height="16"><use href="#i-check"/></svg>Dump fee included</li><li><svg width="16" height="16"><use href="#i-check"/></svg>Text confirmation and pickup reminder</li></ul>' +
'</div></div>' +
'<div class="sum__trust"><span class="stars">' + '<svg width="14" height="14"><use href="#i-star"/></svg>'.repeat(5) + '</span> <b>' + Number(g.rating || 5).toFixed(1) + '</b>' + (g.count ? ' &middot; ' + g.count + ' Google reviews' : '') +
'<p>&ldquo;Dropped off the dumpster exactly when they said, and set it on wooden beams so it wouldn&rsquo;t damage my driveway.&rdquo;</p><cite>Nadine Rendon, Google review</cite></div>' +
'<p class="sum__help">Questions first? <a href="' + telHref + '">Call ' + phone + '</a>. The owner answers.</p>' +
'</aside></main>' +
'<div class="paybar" id="paybar"><div><small id="pbSub">Pick what you need</small><b id="pbTotal">-</b></div><button type="button" id="pbGo">Continue</button></div>' +
'<div class="miss" id="miss" role="dialog" aria-modal="true" aria-labelledby="missH"><div class="miss__in"><h3 id="missH">Almost there</h3>' +
'<p>Before you continue, fill in <b id="missN">a few things</b>:</p><ul class="miss__list" id="missList"></ul>' +
'<div class="miss__acts"><button type="button" id="missGo">Take me there</button><button type="button" class="ghost" id="missX">Close</button></div></div></div>' +
'<script src="/assets/t.js" defer></script>' +
'<script>var PRICING=' + JSON.stringify(pricing) + ';var SVC_LABELS=' + JSON.stringify(svcLabels) + ';var BIZ=' + JSON.stringify(biz.name) + ';var PHONE=' + JSON.stringify(phone) + ';var TEL=' + JSON.stringify(telHref) + ';' +
'var CDD_GROUND=' + JSON.stringify(groundCdd) + ';var CDD_DEBRIS=' + JSON.stringify(debrisCdd) + ';var RULES=' + JSON.stringify(RULES) + ';var CDD_COMM=' + JSON.stringify(commIntCdd) + ';(function(){' +
'var f=document.getElementById("f"),out=document.getElementById("out"),confirmEl=document.getElementById("confirm"),btn=document.getElementById("submitBtn");' +
'var resi=document.getElementById("resi"),comm=document.getElementById("comm");' +
'function money(c){return "$"+(c/100).toFixed(2);}' +
'function esc(s){return String(s==null?"":s).replace(/[&<>"\']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;","\'":"&#39;"}[c];});}' +
'function sel(n){var el=f.querySelector("input[name=\\""+n+"\\"]:checked");return el?el.value:"";}' +
'function curSvc(){var el=f.querySelector("input[name=service_type]");return (el&&el.value)||"dumpster";}' +
'function acctType(){return sel("account_type")||"residential";}' +
'function pad(n){return (n<10?"0":"")+n;}' +
'function isoOf(y,m,d){return y+"-"+pad(m+1)+"-"+pad(d);}' +
'function isWeekendISO(v){if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(v))return false;var d=new Date(v+"T12:00:00Z").getUTCDay();return d===0||d===6;}' +
// ---- date bounds (tomorrow .. +90 days) computed in local time ----
'var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];' +
'var MON3=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];' +
'var _t=new Date();var _e=RULES.earliest.split("-");var MINDATE=new Date(+_e[0],+_e[1]-1,+_e[2]);var MAXDATE=new Date(_t.getFullYear(),_t.getMonth(),_t.getDate()+90);' +
'function fmtDisplay(iso){var p=String(iso).split("-");return MON3[(+p[1])-1]+" "+(+p[2])+", "+p[0];}' +
'function dateAllowed(y,m,d){var dt=new Date(y,m,d);if(dt<MINDATE||dt>MAXDATE)return false;if(RULES.closed.indexOf(isoOf(y,m,d))>=0||RULES.run.indexOf(dt.getDay())<0)return false;if(curSvc()==="junk"){var wd=dt.getDay();if(wd!==0&&wd!==6)return false;}return true;}' +
// ---- service group show/hide + required hinting (residential) ----
'function setGroup(svc){[].forEach.call(f.querySelectorAll("input[name=svc_choice]"),function(r){r.checked=(r.value===svc);});[].forEach.call(resi.querySelectorAll("[data-svc]"),function(g){var on=g.getAttribute("data-svc")===svc;g.classList.toggle("hidden",!on);[].forEach.call(g.querySelectorAll("input,select,textarea"),function(el){el.disabled=!on;});});}' +
'function applyRequired(svc){' +
'["bin_size","rental_tier","ground_condition","permit_needed","rental_days","pickup_address","permit_obtainable","existing_ref"].forEach(function(n){[].forEach.call(f.querySelectorAll("[name=\\""+n+"\\"]"),function(el){el.required=false;});});' +
'if(acctType()!=="residential")return;' +
'if(svc==="dumpster"){[].forEach.call(f.querySelectorAll("[name=bin_size]"),function(el){el.required=true;});[].forEach.call(f.querySelectorAll("[name=rental_tier]"),function(el){el.required=true;});var gc=f.querySelector("[name=ground_condition]");if(gc)gc.required=true;[].forEach.call(f.querySelectorAll("[name=permit_needed]"),function(el){el.required=true;});}' +
'if(svc==="trailer"){var rd=f.querySelector("[name=rental_days]");if(rd)rd.required=true;}' +
'}' +
'function applyDateConstraints(svc){document.getElementById("weekendnote").style.display=(svc==="junk")?"block":"none";' +
'if(svc==="junk"&&selectedISO&&!isWeekendISO(selectedISO)){clearDate();}renderCal();}' +
'function switchSvc(svc){var hs=f.querySelector("input[name=service_type]");if(hs)hs.value=svc;setGroup(svc);applyRequired(svc);applyDateConstraints(svc);' +
'document.getElementById("pagetitle").textContent="Book Your "+(SVC_LABELS[svc]||"");document.title="Book "+(SVC_LABELS[svc]||"")+" - "+BIZ;recalc();}' +
// ---- account-type switch: residential booking vs commercial lead ----
'function switchAcct(t){var isC=(t==="commercial");comm.classList.toggle("hidden",!isC);resi.classList.toggle("hidden",isC);' +
'[].forEach.call(resi.querySelectorAll("input,select,textarea"),function(el){el.disabled=isC;});' +
'[].forEach.call(comm.querySelectorAll("input,select,textarea"),function(el){el.disabled=!isC;});' +
'document.getElementById("sumAside").classList.toggle("hidden",isC);document.getElementById("paybar").classList.toggle("hidden",isC);document.getElementById("secureLine").classList.toggle("hidden",isC);document.body.classList.toggle("has-paybar",!isC);' +
'if(isC){document.getElementById("pagetitle").textContent="Request a Commercial Quote";document.title="Request a Quote - "+BIZ;btn.textContent="Send request";}' +
'else{switchSvc(curSvc());}}' +
'function paintPrices(){var tr=sel("rental_tier")||"1-3",sz=sel("bin_size")||"20";[].forEach.call(document.querySelectorAll("[data-px]"),function(e){var b=PRICING.bins[e.getAttribute("data-px")];if(b&&b.prices[tr]!=null)e.textContent=money0(b.prices[tr]);});[].forEach.call(document.querySelectorAll("[data-tier]"),function(e){var b=PRICING.bins[sz];var v=b&&b.prices[e.getAttribute("data-tier")];e.textContent=v!=null?money0(v):"";});}' +
'function money0(c){return "$"+(c%100===0?String(c/100):(c/100).toFixed(2));}' +
'function payUi(total,label){var pt=document.getElementById("pbTotal"),ps=document.getElementById("pbSub");if(total==null){pt.textContent="-";ps.textContent="Pick what you need";if(acctType()==="residential")btn.textContent="Continue to secure payment";return;}pt.textContent=money(total);ps.textContent=label+" - total";if(acctType()==="residential")btn.textContent="Continue to secure payment - "+money(total);}' +
'function recalc(){paintPrices();var svc=curSvc();var lab=document.getElementById("sumlabel"),sub=document.getElementById("sumsub"),tx=document.getElementById("sumtax"),to=document.getElementById("sumtot");' +
'var depRow=document.getElementById("sumdeprow"),depEl=document.getElementById("sumdep");depRow.style.display="none";' +
'var discRow=document.getElementById("sumdiscrow");discRow.style.display="none";' +
'var fuelRow=document.getElementById("sumfuelrow");fuelRow.style.display="none";fuelPaint();' +
'var p=null,label="",deposit=0;' +
'if(svc==="dumpster"){var s=sel("bin_size"),trr=sel("rental_tier");if(!s||!trr){lab.textContent="Select size + length";sub.textContent="-";tx.textContent="-";to.textContent="-";payUi(null);return;}p=PRICING.bins[s].prices[trr];label=PRICING.bins[s].label+" - "+PRICING.tiers[trr].label;' +
'var ks=[];[].forEach.call(f.querySelectorAll("input[data-addon]"),function(c){if(c.checked){ks.push(c.getAttribute("data-addon"));PRICING.addons.forEach(function(a){if(a.k===c.getAttribute("data-addon"))p+=a.cents;});}});if(f.addons)f.addons.value=ks.join(",");if(ks.length)label+=" + add-ons";}' +
'else if(svc==="trailer"){var days=parseInt(f.rental_days.value,10);var sd=PRICING.services.trailer;if(!days||days<sd.minDays||days>sd.maxDays){lab.textContent="Enter rental days ("+sd.minDays+"-"+sd.maxDays+")";sub.textContent="-";tx.textContent="-";to.textContent="-";payUi(null);return;}p=sd.dayRate_cents*days;label=money(sd.dayRate_cents)+"/day x "+days+" day"+(days>1?"s":"");deposit=sd.deposit_cents;}' +
'else if(svc==="junk"){p=PRICING.services.junk.flat_cents;label=(SVC_LABELS.junk||"Junk Removal")+" (flat)";}' +
'else if(svc==="binswitch"){p=PRICING.services.binswitch.flat_cents;label=(SVC_LABELS.binswitch||"Bin Switch")+" (flat)";}' +
'var disc=0;if(PROMO){disc=Math.min(p,Math.round(p*PROMO.pct/100));if(disc>0){discRow.style.display="";document.getElementById("sumdisclabel").textContent=PROMO.code+" ("+PROMO.pct+"% off)";document.getElementById("sumdisc").textContent="\\u2212"+money(disc);}}' +
// the fuel charge is its own line, taxed, never discounted
'var fc=fuelCents(svc);if(fc){fuelRow.style.display="";document.getElementById("sumfuellabel").textContent=FUEL.label;document.getElementById("sumfuel").textContent=money(fc);}' +
// Total = what Stripe charges, so it includes the trailer's refundable deposit
'var tax=Math.round((p+fc-disc)*PRICING.taxRate);lab.textContent=label;sub.textContent=money(p);tx.textContent=money(tax);to.textContent=money(p+fc-disc+tax+deposit);' +
'if(deposit>0){depRow.style.display="";depEl.textContent=money(deposit)+" (refundable)";}payUi(p+fc-disc+tax+deposit,label);}' +
// ---- fuel charge: /api/fuel prices the drop-off address (S.fuelMile); the server re-checks on booking ----
'var FUEL=null,fuelT=null,fuelSeq=0,fuelQ="",fuelEl=document.getElementById("fuelmsg"),fuelDef=fuelEl?fuelEl.innerHTML:"";' +
'function fuelCents(svc){return FUEL&&FUEL.known&&!FUEL.far&&FUEL.cents>0&&FUEL.services.indexOf(svc)>=0?FUEL.cents:0;}' +
'function fuelPaint(){if(!fuelEl)return;var on=curSvc()!=="trailer";fuelEl.style.display=on?"":"none";if(!on)return;' +
'if(!FUEL||!FUEL.known){fuelEl.innerHTML=fuelDef;fuelEl.style.color="";return;}' +
'if(FUEL.far){fuelEl.textContent="That\\u2019s about "+FUEL.miles+" miles from our yard, past the "+FUEL.radius+" miles we deliver. Call "+PHONE+" and we\\u2019ll see what we can do.";fuelEl.style.color="var(--err)";return;}' +
// a far drop-off hears a yes first, then the charge
'fuelEl.textContent=FUEL.cents>0?"Good news, we deliver out your way! You\\u2019re about "+FUEL.miles+" miles from our yard, so we add "+money0(FUEL.cents)+" for fuel.":"You\\u2019re about "+FUEL.miles+" miles from our yard. Delivery\\u2019s included.";fuelEl.style.color=FUEL.cents>0?"var(--ink-2)":"var(--ok)";}' +
'function fuelCheck(){var a=f.querySelector("[name=address]");if(!a||!fuelEl)return;var q=a.value.trim();if(q===fuelQ)return;fuelQ=q;var seq=++fuelSeq;' +
'if(q.length<8){FUEL=null;recalc();return;}' +
'fetch("/api/fuel?address="+encodeURIComponent(q)).then(function(r){return r.json();}).then(function(j){if(seq!==fuelSeq)return;FUEL=j&&j.known?j:null;recalc();}).catch(function(){if(seq!==fuelSeq)return;FUEL=null;recalc();});}' +
'(function(){var a=f.querySelector("[name=address]");if(!a)return;a.addEventListener("input",function(){if(fuelT)clearTimeout(fuelT);fuelT=setTimeout(fuelCheck,800);});a.addEventListener("change",fuelCheck);})();' +
// ---- promo code: live check against /api/promo; the server re-validates on booking ----
'document.getElementById("promoA").addEventListener("click",function(){document.getElementById("promoW").classList.remove("hidden");this.classList.add("hidden");var pi=f.querySelector("[name=promo_code]");if(pi)pi.focus();});' +
'var PROMO=null;var promoIn=f.querySelector("[name=promo_code]"),promoMsg=document.getElementById("promomsg"),promoT=null,promoSeq=0;' +
'if(promoIn){promoIn.addEventListener("input",function(){var q=promoIn.value.trim();if(promoT)clearTimeout(promoT);var seq=++promoSeq;' +
'if(!q){PROMO=null;promoMsg.textContent="";recalc();return;}' +
'promoT=setTimeout(function(){fetch("/api/promo?code="+encodeURIComponent(q)).then(function(r){return r.json();}).then(function(j){if(seq!==promoSeq)return;' +
'if(j&&j.valid){PROMO={code:j.code,pct:j.pct};promoMsg.textContent=j.code+" applied: "+j.pct+"% off";promoMsg.style.color="var(--ok)";}' +
'else{PROMO=null;promoMsg.textContent="Code not recognized";promoMsg.style.color="var(--err)";}recalc();}).catch(function(){if(seq!==promoSeq)return;PROMO=null;promoMsg.textContent="";recalc();});},350);});}' +
// ---- reusable custom dropdown: drives a backing hidden <input> with the EXACT
//      name/value the backend expects; native-select-free. opts=[{value,label}].
//      placeholder shown when value is "" and no opt has value "". onChange(value) fires after a pick. ----
'function makeCdd(rootId,opts,placeholder,onChange){var root=document.getElementById(rootId);if(!root)return null;' +
'var btn=root.querySelector(".cdd-btn"),valEl=root.querySelector(".cdd-val"),hid=root.querySelector("input[type=hidden]"),pop=root.querySelector(".cdd-pop");' +
'var active=-1;' +
'function labelFor(v){for(var i=0;i<opts.length;i++){if(opts[i].value===v)return opts[i].label;}return null;}' +
'function paint(){var v=hid.value;var lab=labelFor(v);if(lab===null||(v===""&&placeholder)){valEl.textContent=placeholder||(lab||"");valEl.className="cdd-val ph";}else{valEl.textContent=lab;valEl.className="cdd-val";}}' +
'function build(){pop.innerHTML="";opts.forEach(function(o,i){var li=document.createElement("li");li.className="cdd-opt";li.setAttribute("role","option");li.setAttribute("data-i",i);li.textContent=o.label;li.setAttribute("aria-selected",String(o.value===hid.value));li.addEventListener("mousedown",function(e){e.preventDefault();choose(i);});pop.appendChild(li);});}' +
'function isOpen(){return !pop.hidden;}' +
'function open(){build();pop.hidden=false;btn.classList.add("is-open");btn.setAttribute("aria-expanded","true");var si=-1;for(var i=0;i<opts.length;i++){if(opts[i].value===hid.value){si=i;break;}}setActive(si>=0?si:0,false);}' +
'function close(){pop.hidden=true;btn.classList.remove("is-open");btn.setAttribute("aria-expanded","false");active=-1;}' +
'function setActive(n,scroll){var lis=pop.querySelectorAll(".cdd-opt");if(!lis.length)return;active=(n+lis.length)%lis.length;lis.forEach(function(li,i){li.classList.toggle("cdd-active",i===active);});if(scroll!==false&&lis[active])lis[active].scrollIntoView({block:"nearest"});}' +
'function set(v){hid.value=v;paint();}' +
'function choose(i){if(i<0||i>=opts.length)return;hid.value=opts[i].value;paint();close();btn.classList.remove("is-missing");btn.focus();if(onChange)onChange(opts[i].value);}' +
'btn.addEventListener("click",function(e){e.stopPropagation();if(isOpen())close();else open();});' +
'btn.addEventListener("keydown",function(e){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();if(!isOpen()){open();}else{setActive(active+(e.key==="ArrowDown"?1:-1));}}else if(e.key==="Enter"||e.key===" "||e.key==="Spacebar"){e.preventDefault();if(!isOpen())open();else choose(active);}else if(e.key==="Escape"){if(isOpen()){e.stopPropagation();close();}}else if(e.key==="Tab"){if(isOpen())close();}});' +
'pop.addEventListener("keydown",function(e){if(e.key==="Escape"){e.stopPropagation();close();btn.focus();}});' +
'document.addEventListener("click",function(e){if(isOpen()&&!root.contains(e.target))close();});' +
'paint();return {set:set,get:function(){return hid.value;},close:close};}' +
// ---- custom calendar date picker (vanilla; month names; tomorrow..+90; junk=weekends) ----
'var selectedISO="";var viewY,viewM;var calPop=document.getElementById("calPop"),dateBtn=document.getElementById("dateBtn"),dateBtnText=document.getElementById("dateBtnText"),hidDate=document.getElementById("deliveryDate");' +
'function clearDate(){selectedISO="";hidDate.value="";dateBtnText.textContent="Select a date";dateBtnText.className="ph";}' +
'function setDate(iso){selectedISO=iso;hidDate.value=iso;dateBtnText.textContent=fmtDisplay(iso);dateBtnText.className="";dateBtn.classList.remove("is-missing");}' +
'function renderCal(){var title=document.getElementById("calTitle"),grid=document.getElementById("calGrid");title.textContent=MONTHS[viewM]+" "+viewY;' +
'var minM=MINDATE.getFullYear()*12+MINDATE.getMonth(),maxM=MAXDATE.getFullYear()*12+MAXDATE.getMonth(),curM=viewY*12+viewM;' +
'document.getElementById("calPrev").disabled=(curM<=minM);document.getElementById("calNext").disabled=(curM>=maxM);' +
'var first=new Date(viewY,viewM,1).getDay();var days=new Date(viewY,viewM+1,0).getDate();var todayISO=isoOf(_t.getFullYear(),_t.getMonth(),_t.getDate());var html="";' +
'for(var i=0;i<first;i++){html+="<span class=\\"cal-cell empty\\"></span>";}' +
'for(var d=1;d<=days;d++){var iso=isoOf(viewY,viewM,d);var ok=dateAllowed(viewY,viewM,d);var cls="cal-cell";if(iso===selectedISO)cls+=" sel";if(iso===todayISO)cls+=" today";' +
'html+="<button type=\\"button\\" class=\\""+cls+"\\" data-iso=\\""+iso+"\\""+(ok?"":" disabled")+">"+d+"</button>";}' +
'grid.innerHTML=html;}' +
'function openCal(){var base=selectedISO?selectedISO.split("-"):null;if(base){viewY=+base[0];viewM=(+base[1])-1;}else{viewY=MINDATE.getFullYear();viewM=MINDATE.getMonth();}' +
'renderCal();calPop.hidden=false;dateBtn.classList.add("is-open");dateBtn.setAttribute("aria-expanded","true");}' +
'function closeCal(){calPop.hidden=true;dateBtn.classList.remove("is-open");dateBtn.setAttribute("aria-expanded","false");}' +
'dateBtn.addEventListener("click",function(e){e.stopPropagation();if(calPop.hidden)openCal();else closeCal();});' +
'document.getElementById("calPrev").addEventListener("click",function(e){e.stopPropagation();viewM--;if(viewM<0){viewM=11;viewY--;}renderCal();});' +
'document.getElementById("calNext").addEventListener("click",function(e){e.stopPropagation();viewM++;if(viewM>11){viewM=0;viewY++;}renderCal();});' +
'document.getElementById("calGrid").addEventListener("click",function(e){var b=e.target.closest("button[data-iso]");if(!b||b.disabled)return;e.stopPropagation();setDate(b.getAttribute("data-iso"));renderCal();closeCal();});' +
'document.addEventListener("click",function(e){if(!calPop.hidden&&!document.getElementById("datepick").contains(e.target))closeCal();});' +
'document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!calPop.hidden){closeCal();dateBtn.focus();}});' +
// ---- 12-hour AM/PM time options (optional; value === display string; "" = no preference) ----
'var CDD_TIME=[{value:"",label:"No preference"},{value:"Early morning (7-10 AM)",label:"Early morning (7 - 10 AM)"},{value:"Midday (10 AM-2 PM)",label:"Midday (10 AM - 2 PM)"},{value:"Later in the day (2-6 PM)",label:"Later in the day (2 - 6 PM)"}];' +
// ---- instantiate the four custom dropdowns (service drives the form; others are plain value pickers) ----
'makeCdd("cdd-time",CDD_TIME,"No preference",null);' +
'makeCdd("cdd-ground",CDD_GROUND,"Select...",null);' +
'if(document.getElementById("cdd-debris"))makeCdd("cdd-debris",CDD_DEBRIS,"Not sure / mixed",null);' +
'makeCdd("cdd-comm",CDD_COMM,"Not sure yet",null);' +
// ---- keyless address autocomplete (graceful) ----
'function attachAC(input,listId){var list=document.getElementById(listId);if(!input||!list)return;var t=null,active=-1,items=[],lastQ="";' +
'function close(){list.hidden=true;list.innerHTML="";active=-1;items=[];}' +
'var okEl=document.querySelector("[data-ok-for=\\""+input.name+"\\"]");' +
'function pick(it){input.value=it.label;close();input.dispatchEvent(new Event("input",{bubbles:true}));lastQ=input.value.trim();if(okEl)okEl.hidden=false;}' +
'function render(arr){var seen={};arr=arr.filter(function(it){var k=String(it&&it.label||"").toLowerCase();if(!k||seen[k])return false;seen[k]=1;return true;}).slice(0,5);items=arr;active=-1;if(!arr.length){close();return;}list.innerHTML="";arr.forEach(function(it,i){var li=document.createElement("li");li.className="ac-item";li.setAttribute("role","option");li.textContent=it.label;li.addEventListener("mousedown",function(e){e.preventDefault();pick(it);});list.appendChild(li);});list.hidden=false;}' +
'function setActive(n){var lis=list.querySelectorAll(".ac-item");if(!lis.length)return;active=(n+lis.length)%lis.length;lis.forEach(function(li,i){li.classList.toggle("ac-active",i===active);});}' +
'input.addEventListener("input",function(ev){if(ev.isTrusted&&okEl)okEl.hidden=true;var q=input.value.trim();if(t)clearTimeout(t);if(q.length<3){close();return;}if(q===lastQ)return;t=setTimeout(function(){lastQ=q;fetch("/api/geocode?q="+encodeURIComponent(q)).then(function(r){return r.ok?r.json():[];}).then(function(arr){if(input.value.trim()!==q)return;render(Array.isArray(arr)?arr:[]);}).catch(function(){close();});},250);});' +
'input.addEventListener("keydown",function(e){if(list.hidden)return;if(e.key==="ArrowDown"){e.preventDefault();setActive(active+1);}else if(e.key==="ArrowUp"){e.preventDefault();setActive(active-1);}else if(e.key==="Enter"){if(active>=0&&items[active]){e.preventDefault();pick(items[active]);}}else if(e.key==="Escape"){close();}});' +
'input.addEventListener("blur",function(){setTimeout(close,150);});}' +
'attachAC(f.querySelector("[name=address]"),"ac-address");attachAC(f.querySelector("[name=pickup_address]"),"ac-pickup");attachAC(f.querySelector("[name=address_c]"),"ac-address-c");' +
// ---- add-to-calendar helpers (all-day event on the delivery date) ----
'function ymd(iso){return String(iso||"").replace(/-/g,"");}' +
'function nextYmd(iso){var p=String(iso||"").split("-");var d=new Date(Date.UTC(+p[0],(+p[1])-1,+p[2]));d.setUTCDate(d.getUTCDate()+1);return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate());}' +
'function gcalLink(b){var start=ymd(b.delivery_date),end=nextYmd(b.delivery_date);var text=BIZ+" - "+(SVC_LABELS[b.service_type]||"Delivery");' +
'var timeNote=(b.delivery_time)?(" Preferred time "+b.delivery_time+"."):"";' +
'var details="Booking ref "+b.id+". Total "+money(b.amount_cents)+"."+timeNote+" Questions? "+PHONE+".";' +
'return "https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(text)+"&dates="+start+"/"+end+"&details="+encodeURIComponent(details)+"&location="+encodeURIComponent(b.address||"");}' +
'function icsHref(b){var start=ymd(b.delivery_date),end=nextYmd(b.delivery_date);var now=new Date().toISOString().replace(/[-:]/g,"").slice(0,15)+"Z";' +
'var timeNote=(b.delivery_time)?(" Preferred time "+b.delivery_time+".") : "";' +
'var lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Triple R Dump//Booking//EN","BEGIN:VEVENT","UID:"+b.id+"@triplerdump","DTSTAMP:"+now,"DTSTART;VALUE=DATE:"+start,"DTEND;VALUE=DATE:"+end,"SUMMARY:"+BIZ+" - "+(SVC_LABELS[b.service_type]||"Delivery"),"DESCRIPTION:Booking ref "+b.id+". Total "+money(b.amount_cents)+"."+timeNote+" Questions? "+PHONE+".","LOCATION:"+(b.address||"").replace(/,/g,"\\\\,"),"END:VEVENT","END:VCALENDAR"];' +
'return "data:text/calendar;charset=utf-8,"+encodeURIComponent(lines.join("\\r\\n"));}' +
// ---- residential confirmation screen ----
'function showConfirm(j){var b=j.booking;var rows="";' +
'rows+="<li><span class=\\"k\\">Service</span><span class=\\"v\\">"+esc(SVC_LABELS[b.service_type]||b.service_type)+"</span></li>";' +
'if(b.service_type==="dumpster"){rows+="<li><span class=\\"k\\">Bin size</span><span class=\\"v\\">"+esc(b.bin_size)+" yard</span></li>";rows+="<li><span class=\\"k\\">Rental length</span><span class=\\"v\\">"+esc(b.rental_tier)+" day</span></li>";}' +
'else if(b.service_type==="trailer"){rows+="<li><span class=\\"k\\">Rental days</span><span class=\\"v\\">"+esc(b.rental_days)+" day"+(b.rental_days>1?"s":"")+"</span></li>";}' +
'rows+="<li><span class=\\"k\\">Delivery date</span><span class=\\"v\\">"+esc(fmtDisplay(b.delivery_date))+(b.delivery_time?(" &middot; "+esc(b.delivery_time)):"")+"</span></li>";' +
'if(b.pickup_date&&b.pickup_date!==b.delivery_date){rows+="<li><span class=\\"k\\">Pickup date</span><span class=\\"v\\">"+esc(fmtDisplay(b.pickup_date))+"</span></li>";}' +
'rows+="<li><span class=\\"k\\">Drop-off</span><span class=\\"v\\">"+esc(b.address)+"</span></li>";' +
'rows+="<li><span class=\\"k\\">Subtotal</span><span class=\\"v\\">"+money(b.subtotal_cents)+"</span></li>";' +
'if(b.discount_cents>0){rows+="<li><span class=\\"k\\">Discount"+(b.promo_code?(" ("+esc(b.promo_code)+")"):"")+"</span><span class=\\"v\\">\\u2212"+money(b.discount_cents)+"</span></li>";}' +
'rows+="<li><span class=\\"k\\">Utah sales tax</span><span class=\\"v\\">"+money(b.tax_cents)+"</span></li>";' +
'rows+="<li class=\\"tot\\"><span class=\\"k\\">Total</span><span class=\\"v\\">"+money(b.amount_cents)+"</span></li>";' +
'if(b.deposit_cents>0){rows+="<li class=\\"dep\\"><span class=\\"k\\">Refundable deposit</span><span class=\\"v\\">"+money(b.deposit_cents)+"</span></li>";}' +
'var html="<div class=\\"confirm\\"><div class=\\"confirm-head\\"><div class=\\"check\\" aria-hidden=\\"true\\">&#10003;</div>"+' +
'"<h2>You\'re booked!</h2><p>"+esc(j.message||"We\'ll be in touch with details.")+"</p>"+' +
'"<div class=\\"refbox\\"><span class=\\"reflabel\\">Booking ref</span><span class=\\"ref\\">"+esc(b.id)+"</span></div></div>"+' +
'"<div class=\\"confirm-body\\"><h3>Your booking</h3><ul class=\\"recap\\">"+rows+"</ul>"+' +
'"<h3>What happens next</h3><div class=\\"next\\"><ul>"+' +
'"<li>We\'ll reach out to <strong>confirm the details</strong> and your delivery window.</li>"+' +
'"<li>Your <strong>dump fee is included</strong> - the price you see is the price you pay.</li>"+' +
'"<li>Need a change? <strong>Call us</strong> and we\'ll sort it out.</li></ul></div>"+' +
'"<div class=\\"cal-actions\\"><a class=\\"btn2\\" id=\\"icsbtn\\" download=\\""+esc(BIZ)+"-"+esc(b.id)+".ics\\" href=\\"#\\">&#128197; Add to calendar</a>"+' +
'"<a class=\\"btn2\\" target=\\"_blank\\" rel=\\"noopener\\" href=\\""+esc(gcalLink(b))+"\\">Google Calendar</a></div>"+' +
'"<p class=\\"confirm-foot\\">Questions about your booking? Call <a href=\\""+esc(TEL)+"\\">"+esc(PHONE)+"</a>.</p></div></div>";' +
'confirmEl.innerHTML=html;var ics=document.getElementById("icsbtn");if(ics)ics.setAttribute("href",icsHref(b));' +
'f.classList.add("hidden");out.classList.add("hidden");confirmEl.classList.remove("hidden");document.body.classList.add("is-done");' +
'window.scrollTo({top:0,behavior:"smooth"});}' +
// ---- commercial "we'll reach out" screen (no price recap) ----
'function showLeadConfirm(j){' +
'var html="<div class=\\"confirm\\"><div class=\\"confirm-head\\"><div class=\\"check\\" aria-hidden=\\"true\\">&#10003;</div>"+' +
'"<h2>Request received</h2><p>"+esc(j.message||("Joseph will reach out shortly. Need it sooner? Call "+PHONE+"."))+"</p>"+' +
'(j.id?("<div class=\\"refbox\\"><span class=\\"reflabel\\">Reference</span><span class=\\"ref\\">"+esc(j.id)+"</span></div>"):"")+"</div>"+' +
'"<div class=\\"confirm-body\\"><h3>What happens next</h3><div class=\\"next\\"><ul>"+' +
'"<li>Joseph will <strong>reach out shortly</strong> to set up your job and account.</li>"+' +
'"<li>We\'ll <strong>confirm scope, timing, and pricing</strong> for your business.</li>"+' +
'"<li>Need it sooner? <strong>Call us</strong> and we\'ll get moving.</li></ul></div>"+' +
'"<p class=\\"confirm-foot\\">Questions? Call <a href=\\""+esc(TEL)+"\\">"+esc(PHONE)+"</a>.</p></div></div>";' +
'confirmEl.innerHTML=html;f.classList.add("hidden");out.classList.add("hidden");confirmEl.classList.remove("hidden");document.body.classList.add("is-done");' +
'window.scrollTo({top:0,behavior:"smooth"});}' +
// ---- init + query params ----
// service is pre-selected SERVER-side from ?service= (hidden input value); ?size= falls back to dumpster (server default).
'var ps=new URLSearchParams(location.search),qsz=ps.get("size"),qtr=ps.get("tier")||"1-3";' +
'[].forEach.call(f.bin_size||[],function(r){if(r.value===qsz){r.checked=true;}});if(qsz){[].forEach.call(f.rental_tier||[],function(r){if(r.value===qtr){r.checked=true;}});}' +
// Arrived via Stripe's back arrow (cancel_url) — the hold was already released
// server-side; reassure and invite a retry instead of leaving a blank form.
'if(ps.get("canceled")){out.className="out";out.classList.remove("hidden");out.textContent="Checkout was canceled and nothing was charged. Pick your dates below to try again, or call "+PHONE+".";}' +
// Safari/iOS restores this page from the back-forward cache EXACTLY as it was
// left: submit disabled, status stuck on "Checking availability..." — a dead
// form (this stranded a real customer). Re-arm it on restore.
'window.addEventListener("pageshow",function(ev){if(ev.persisted){btn.disabled=false;if(!ps.get("canceled")){out.classList.add("hidden");}}});' +
'f.addEventListener("change",function(e){' +
'if(e.target.name==="account_type"){switchAcct(e.target.value);return;}' +
'if(e.target.hasAttribute&&e.target.hasAttribute("data-addon")){recalc();return;}' +
'if(e.target.name==="svc_choice"){switchSvc(e.target.value);return;}' +
'clearMiss(e.target);' +
// service_type is a hidden input driven by the custom Service dropdown (its onChange calls switchSvc) - no change event here.
'if(e.target.name==="permit_needed"){document.getElementById("permwrap").classList.toggle("hidden",e.target.value!=="yes");}' +
'if(e.target.id==="samepick"){document.getElementById("pickwrap").classList.toggle("hidden",e.target.checked);}' +
'recalc();});' +
'f.addEventListener("input",function(e){clearMiss(e.target);if(e.target.name==="rental_days")recalc();});' +
// ---- what's missing: a short list before the request goes anywhere ----
'var missEl=document.getElementById("miss"),missList=document.getElementById("missList");' +
'function fval(n){var el=f.querySelector("[name="+n+"]");return el?String(el.value||"").trim():"";}' +
'function digits(v){return String(v||"").replace(/\\D/g,"");}' +
'var EMAIL_RE=/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/;' +
'function markEl(name){if(name==="delivery_date")return document.getElementById("dateBtn");if(name==="ground_condition")return document.querySelector("#cdd-ground .cdd-btn");if(name==="bin_size")return document.getElementById("fs-size");if(name==="rental_tier")return document.getElementById("fs-tier");if(name==="permit_needed")return document.getElementById("fs-permit");if(name==="agreed_terms")return document.getElementById("termsL");if(name==="agreed_terms_c")return document.getElementById("termsC");return f.querySelector("[name="+name+"]");}' +
'function missing(){var m=[];function add(label,name){m.push({label:label,name:name});}' +
'if(acctType()==="commercial"){if(fval("company_c").length<2)add("Company name","company_c");if(fval("contact_name").length<2)add("Contact name","contact_name");if(digits(fval("phone_c")).length<10)add("Phone number","phone_c");if(!EMAIL_RE.test(fval("email_c")))add("Email address","email_c");if(fval("address_c").length<5)add("Job site address","address_c");if(fval("details").length<2)add("A few details about the job","details");if(!f.agreed_terms_c.checked)add("Agree to the terms","agreed_terms_c");return m;}' +
'var svc=curSvc();if(svc==="dumpster"){if(!sel("bin_size"))add("Bin size","bin_size");if(!sel("rental_tier"))add("Rental length","rental_tier");}' +
'if(svc==="trailer"){var d=parseInt(fval("rental_days"),10);if(!d||d<PRICING.services.trailer.minDays||d>PRICING.services.trailer.maxDays)add("Rental days","rental_days");}' +
'if(!hidDate.value)add("Delivery date","delivery_date");else if(svc==="junk"&&!isWeekendISO(hidDate.value))add("A Saturday or Sunday (junk removal is weekends only)","delivery_date");' +
'if(fval("address").length<5)add("Drop-off address","address");' +
'if(svc==="dumpster"){if(!document.getElementById("samepick").checked&&fval("pickup_address").length<5)add("Pick-up address","pickup_address");if(!fval("ground_condition"))add("Where the bin will sit","ground_condition");if(!sel("permit_needed"))add("Permit or HOA approval (yes or no)","permit_needed");}' +
'if((fval("first_name")+" "+fval("last_name")).trim().length<2)add("Your name",fval("first_name")?"last_name":"first_name");' +
'if(digits(fval("phone")).length<10)add("Mobile phone (10 digits)","phone");' +
'if(!EMAIL_RE.test(fval("email")))add("Email address","email");' +
'if(!f.agreed_terms.checked)add("Agree to the terms","agreed_terms");return m;}' +
'function clearMiss(t){if(!t)return;var n=t.name;if(!n)return;if(n==="delivery_time")return;var el=markEl(n);if(el)el.classList.remove("is-missing");}' +
'function goTo(name){missEl.classList.remove("on");var el=markEl(name);if(!el)return;el.scrollIntoView({behavior:"smooth",block:"center"});var foc=(el.matches&&el.matches("input,button,textarea"))?el:el.querySelector("input,button,textarea");if(foc)setTimeout(function(){try{foc.focus({preventScroll:true});}catch(e){}},350);}' +
'function showMissing(m){[].forEach.call(f.querySelectorAll(".is-missing"),function(e){e.classList.remove("is-missing");});m.forEach(function(x){var el=markEl(x.name);if(el)el.classList.add("is-missing");});missList.innerHTML="";m.forEach(function(x){var li=document.createElement("li"),b=document.createElement("button");b.type="button";b.textContent=x.label;b.addEventListener("click",function(){goTo(x.name);});li.appendChild(b);missList.appendChild(li);});document.getElementById("missN").textContent=m.length===1?"1 thing":m.length+" things";missEl.classList.add("on");var go=document.getElementById("missGo");go.onclick=function(){goTo(m[0].name);};go.focus();}' +
'document.getElementById("missX").addEventListener("click",function(){missEl.classList.remove("on");});' +
'missEl.addEventListener("click",function(e){if(e.target===missEl)missEl.classList.remove("on");});' +
'document.addEventListener("keydown",function(e){if(e.key==="Escape")missEl.classList.remove("on");});' +
'document.getElementById("pbGo").addEventListener("click",function(){if(f.requestSubmit)f.requestSubmit(btn);else btn.click();});' +
// ---- submit: branch on account type ----
'f.addEventListener("submit",async function(e){e.preventDefault();' +
'var gaps=missing();if(gaps.length){showMissing(gaps);return;}' +
'if(acctType()==="commercial"){return submitLead();}' +
'var svc=curSvc();' +
'if(svc==="junk"&&!isWeekendISO(hidDate.value)){out.className="out err";out.classList.remove("hidden");out.textContent="Junk removal is weekends only - pick a Saturday or Sunday.";return;}' +
'btn.disabled=true;out.className="out";out.classList.remove("hidden");out.textContent="Checking availability...";' +
'var data=Object.fromEntries(new FormData(f).entries());data.service_type=svc;data.account_type="residential";data.agreed_terms=f.agreed_terms.checked;data.sms_consent=f.agreed_terms.checked;delete data.svc_choice;' +
'if(svc==="dumpster"&&document.getElementById("samepick").checked){data.pickup_address=data.address;}' +
'try{var r=await fetch("/api/book",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});var j=await r.json();' +
'if(!j.ok){out.className="out err";out.innerHTML="<b>Could not book:</b><br>"+((j.errors||[j.error])||[]).map(esc).join("<br>");btn.disabled=false;return;}' +
'if(j.checkout_url){window.location=j.checkout_url;return;}' +
'showConfirm(j);}' +
'catch(err){out.className="out err";out.textContent="Network error - try again.";btn.disabled=false;}});' +
// ---- commercial lead submit ----
'async function submitLead(){' +
'btn.disabled=true;out.className="out";out.classList.remove("hidden");out.textContent="Sending your request...";' +
'var fd=new FormData(f);var data={account_type:"commercial",company:fd.get("company_c")||"",customer_name:fd.get("contact_name")||"",phone:fd.get("phone_c")||"",email:fd.get("email_c")||"",address:fd.get("address_c")||"",service_interest:fd.get("service_interest")||"",timeframe:fd.get("timeframe")||"",message:fd.get("details")||"",details:fd.get("details")||"",trd_hp:fd.get("trd_hp")||"",agreed_terms:f.agreed_terms_c.checked,sms_consent:f.agreed_terms_c.checked};' +
'try{var r=await fetch("/api/book",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});var j=await r.json();' +
'if(!j.ok){out.className="out err";out.innerHTML="<b>Could not send request:</b><br>"+((j.errors||[j.error])||[]).map(esc).join("<br>");btn.disabled=false;return;}' +
'showLeadConfirm(j);}' +
'catch(err){out.className="out err";out.textContent="Network error - try again.";btn.disabled=false;}}' +
// ---- boot ----
'switchAcct(acctType());switchSvc(curSvc());})();' +
'</script></body></html>';
}
