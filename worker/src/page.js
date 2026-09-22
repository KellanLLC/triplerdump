// Standalone booking page at /book. Reads effective settings (S) so prices/caps
// reflect CMS edits. CLEAN/minimal checkout aesthetic (light bg, white card,
// brand-blue accents) - intentionally NOT the textured marketing skin; a booking
// form converts better when it feels like filling in real info, not decoration.
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
    bins: Object.fromEntries(Object.entries(S.bins).map(([k, b]) => [k, { label: b.label, prices: b.prices }])),
    tiers: Object.fromEntries(Object.entries(S.tiers).map(([k, t]) => [k, { label: t.label }])),
    services: {
      trailer: { dayRate_cents: tr.dayRate_cents || 20000, minDays: tr.minDays || 1, maxDays: tr.maxDays || 14, deposit_cents: tr.deposit_cents || 30000 },
      junk: { flat_cents: jk.flat_cents || 55000 },
      binswitch: { flat_cents: bs.flat_cents || 20000 },
    },
  };

  // Size = 3-across segmented cards; length = 2-across. "rental" sits on its own
  // muted line so "4-7 day" never crowds into "rental".
  const sizeRadios = Object.entries(S.bins).map(([size, b]) =>
    '<label class="opt"><input type="radio" name="bin_size" value="' + size + '"><span class="card"><b>' + b.label + '</b></span></label>'
  ).join("");
  const tierRadios = Object.entries(S.tiers).map(([t, v]) =>
    '<label class="opt"><input type="radio" name="rental_tier" value="' + t + '"><span class="card"><b>' + v.label + '</b><span class="mut">rental</span></span></label>'
  ).join("");
  // Option lists for the custom dropdowns (built client-side from these arrays).
  const groundCdd = S.groundConditions.map((g) => ({ value: g, label: g }));
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
'<meta name="theme-color" content="#116DFF">' +
'<link rel="icon" href="/favicon.ico" sizes="any">' +
'<link rel="icon" href="/assets/favicon-32x32.png" type="image/png" sizes="32x32">' +
'<style>' +
// --- clean light base: system font, no textures ---
':root{--blue:#116DFF;--blue-deep:#0b54cc;--blue-soft:#eef4ff;--blue-line:#cfe0ff;' +
'--ink:#0b1b2b;--ink-2:#5a6b7d;--line:#dde5ef;--bg:#f5f8fc;--card:#fff;--ok:#16a34a;--err:#dc2626;' +
'--radius:12px;--radius-sm:9px;--shadow:0 1px 2px rgba(16,40,80,.04),0 8px 24px rgba(16,40,80,.06)}' +
'*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}' +
'html{-webkit-text-size-adjust:100%}' +
'body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:var(--ink);background:var(--bg);min-height:100vh}' +
'img{max-width:100%;display:block}a{color:var(--blue)}' +
':focus-visible{outline:2px solid var(--blue);outline-offset:2px}' +
// --- top bar / small wordmark ---
'.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:600px;margin:0 auto;padding:16px 16px 0}' +
'.mark img{height:26px;width:auto;display:block}' +
'.backlink{font-size:13px;font-weight:600;color:var(--ink-2);text-decoration:none;display:inline-flex;align-items:center;gap:.35rem;padding:6px 4px}' +
'.backlink:hover{color:var(--ink)}' +
// --- layout ---
'.wrap{max-width:600px;margin:0 auto;padding:14px 16px 56px}' +
'h1{font-size:22px;font-weight:800;letter-spacing:-.01em;margin:6px 0 2px}' +
'.sub{color:var(--ink-2);font-size:14px;margin:0 0 16px}' +
'.sub a{color:var(--blue);text-decoration:none;font-weight:600;white-space:nowrap}' +
// --- card / form ---
'form{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px;box-shadow:var(--shadow)}' +
'fieldset{border:0;padding:0;margin:0 0 14px}' +
'legend{font-weight:700;font-size:13px;letter-spacing:.01em;margin-bottom:7px;padding:0;color:var(--ink)}' +
// --- account-type selector (prominent, at top) ---
'.acct{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 18px;align-items:stretch}' +
'.acct .ac-card{position:relative;display:block;height:100%;cursor:pointer}' +
'.acct input{position:absolute;opacity:0;width:0;height:0}' +
'.acct .ac-card .box{display:flex;flex-direction:column;justify-content:center;gap:.1rem;height:100%;border:1.5px solid var(--line);border-radius:var(--radius-sm);padding:.7rem .8rem;min-height:64px;background:var(--card);transition:border-color .12s,background-color .12s,box-shadow .12s}' +
'.acct .ac-card .t{font-weight:800;font-size:15px;color:var(--ink)}' +
'.acct .ac-card .d{font-size:12px;color:var(--ink-2);line-height:1.35}' +
'.acct .ac-card .box:hover{border-color:#9db8e6}' +
'.acct input:checked+.box{border-color:var(--blue);background:var(--blue-soft);box-shadow:0 0 0 1px var(--blue) inset}' +
'.acct input:focus-visible+.box{outline:2px solid var(--blue);outline-offset:2px}' +
// --- reusable custom dropdown (replaces native <select>; owner dislikes native UI) ---
'.cdd{position:relative;margin-top:5px;display:block}' +
'.cdd-btn{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.65rem .7rem;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--card);color:var(--ink);font:inherit;font-size:15px;font-weight:400;cursor:pointer;text-align:left}' +
'.cdd-btn:hover{border-color:#9db8e6}' +
'.cdd-btn.is-open{border-color:var(--blue);box-shadow:0 0 0 3px rgba(17,109,255,.18)}' +
'.cdd-btn .cdd-val{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
'.cdd-btn .cdd-val.ph{color:var(--ink-2);opacity:.8}' +
'.cdd-chev{flex-shrink:0;width:.55rem;height:.55rem;border-right:2px solid var(--ink-2);border-bottom:2px solid var(--ink-2);transform:rotate(45deg);transition:transform .15s;margin-top:-3px}' +
'.cdd-btn.is-open .cdd-chev{transform:rotate(-135deg);margin-top:2px}' +
'.cdd-pop{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:35;background:var(--card);border:1px solid var(--blue-line);border-radius:var(--radius-sm);box-shadow:0 12px 32px rgba(16,40,80,.18);max-height:15rem;overflow-y:auto;list-style:none;padding:4px}' +
'.cdd-pop[hidden]{display:none}' +
'.cdd-opt{display:flex;align-items:center;min-height:44px;padding:.5rem .65rem;border-radius:7px;cursor:pointer;font-size:15px;color:var(--ink)}' +
'.cdd-opt:hover,.cdd-opt.cdd-active{background:var(--blue-soft)}' +
'.cdd-opt[aria-selected="true"]{color:var(--blue);font-weight:700;background:var(--blue-soft)}' +
'.cdd-opt[aria-selected="true"]:hover,.cdd-opt[aria-selected="true"].cdd-active{background:var(--blue-line)}' +
// --- option cards (size 3-across / length 2-across) as a segmented grid ---
'.opts{display:grid;gap:8px}.opts.sizes{grid-template-columns:repeat(3,1fr)}.opts.lengths{grid-template-columns:repeat(2,1fr)}' +
'.opt{min-width:0}' +
'.opt input{position:absolute;opacity:0;width:0;height:0}' +
'.opt .card{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:0;min-height:46px;border:1.5px solid var(--line);border-radius:var(--radius-sm);padding:.5rem .35rem;cursor:pointer;background:var(--card);transition:border-color .12s,background-color .12s}' +
'.opt .card b{font-weight:700;font-size:14px;line-height:1.15;white-space:nowrap}' +
'.opt .card .mut{display:block;margin-top:1px}' +
'.opt .card:hover{border-color:#9db8e6}' +
'.opt input:checked+.card{border-color:var(--blue);background:var(--blue-soft);box-shadow:0 0 0 1px var(--blue) inset}' +
'.opt input:focus-visible+.card{outline:2px solid var(--blue);outline-offset:2px}' +
'.mut{color:var(--ink-2);font-weight:400;font-size:11.5px}' +
// --- fields ---
'label.f{display:block;margin:0 0 12px;font-weight:600;font-size:13px;color:var(--ink)}' +
'.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
'input[type=text],input[type=tel],input[type=email],input[type=date],input[type=time],input[type=number],select,textarea{width:100%;margin-top:5px;padding:.65rem .7rem;min-height:44px;border:1px solid var(--line);border-radius:var(--radius-sm);font:inherit;font-size:15px;font-weight:400;background:var(--card);color:var(--ink);-webkit-appearance:none;appearance:none}' +
'input::placeholder,textarea::placeholder{color:var(--ink-2);opacity:.65}' +
'input:focus,select:focus,textarea:focus{border-color:var(--blue);outline:none;box-shadow:0 0 0 3px rgba(17,109,255,.18)}' +
'select{background-image:linear-gradient(45deg,transparent 50%,var(--ink-2) 50%),linear-gradient(135deg,var(--ink-2) 50%,transparent 50%);background-position:calc(100% - 18px) 1.15rem,calc(100% - 13px) 1.15rem;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:2.2rem}' +
'textarea{min-height:58px;resize:vertical}' +
'.inline{display:inline-flex;align-items:flex-start;gap:.5rem;font-weight:500;font-size:14px;margin:0 16px 6px 0;min-height:30px;cursor:pointer;color:var(--ink)}' +
'.inline input,.terms input{margin-top:.1rem;width:18px;height:18px;min-height:0;flex-shrink:0;accent-color:var(--blue);cursor:pointer}' +
// --- custom date picker (button-style field + calendar popup) ---
'.picker{position:relative;margin-top:5px}' +
'.picker-btn{width:100%;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.65rem .7rem;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--card);color:var(--ink);font:inherit;font-size:15px;font-weight:400;cursor:pointer;text-align:left}' +
'.picker-btn:hover{border-color:#9db8e6}' +
'.picker-btn.is-open{border-color:var(--blue);box-shadow:0 0 0 3px rgba(17,109,255,.18)}' +
'.picker-btn .ph{color:var(--ink-2);opacity:.8}' +
'.picker-btn .cae{flex-shrink:0;color:var(--blue)}' +
'.cal{position:absolute;left:0;top:calc(100% + 4px);z-index:40;width:18rem;max-width:calc(100vw - 32px);background:var(--card);border:1px solid var(--blue-line);border-radius:var(--radius);box-shadow:0 14px 36px rgba(16,40,80,.2);padding:10px}' +
'.cal[hidden]{display:none}' +
'.cal-top{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px}' +
'.cal-title{font-weight:800;font-size:14px;color:var(--ink)}' +
'.cal-nav{width:32px;height:32px;min-height:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);font-size:15px;cursor:pointer;padding:0}' +
'.cal-nav:hover:not(:disabled){border-color:var(--blue);color:var(--blue)}' +
'.cal-nav:disabled{opacity:.35;cursor:default}' +
'.cal-dow{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}' +
'.cal-dow span{text-align:center;font-size:11px;font-weight:700;color:var(--ink-2);padding:2px 0}' +
'.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}' +
'.cal-cell{aspect-ratio:1/1;min-height:32px;display:flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:transparent;color:var(--ink);font:inherit;font-size:13.5px;cursor:pointer;padding:0}' +
'.cal-cell.empty{visibility:hidden;cursor:default}' +
'.cal-cell:hover:not(:disabled){background:var(--blue-soft)}' +
'.cal-cell:disabled{color:#c2ccd9;cursor:default}' +
'.cal-cell.sel{background:var(--blue);color:#fff;font-weight:700}' +
'.cal-cell.today:not(.sel){box-shadow:0 0 0 1.5px var(--blue-line) inset}' +
// --- autocomplete ---
'.ac-wrap{position:relative}' +
'.ac-list{position:absolute;left:0;right:0;top:calc(100% + 3px);z-index:30;background:var(--card);border:1px solid var(--blue-line);border-radius:var(--radius-sm);box-shadow:0 10px 28px rgba(16,40,80,.16);max-height:14rem;overflow-y:auto;list-style:none}' +
'.ac-list[hidden]{display:none}' +
'.ac-item{padding:.55rem .7rem;cursor:pointer;font-size:14px;border-top:1px solid var(--line);color:var(--ink)}' +
'.ac-item:first-child{border-top:0}' +
'.ac-item:hover,.ac-item.ac-active{background:var(--blue-soft)}' +
// --- summary card ---
'.sumbox{background:var(--blue-soft);border:1px solid var(--blue-line);border-radius:var(--radius-sm);padding:12px 14px;margin:2px 0 14px}' +
'.sumrow{display:flex;justify-content:space-between;gap:12px;margin:.15rem 0;font-size:14px;color:var(--ink-2)}' +
'.sumrow span:last-child{font-variant-numeric:tabular-nums;color:var(--ink);font-weight:600}' +
'.sumrow.tot{font-weight:800;font-size:18px;border-top:1px solid var(--blue-line);margin-top:.45rem;padding-top:.45rem;color:var(--ink)}' +
'.sumrow.tot span:last-child{color:var(--blue)}' +
'.terms{display:flex;gap:.5rem;align-items:flex-start;font-size:13.5px;color:var(--ink-2);margin:6px 0 14px}' +
'.terms a{color:var(--blue)}' +
'.leadnote{font-size:13px;color:var(--ink-2);background:#f3f7fd;border:1px solid var(--line);border-radius:var(--radius-sm);padding:10px 12px;margin:0 0 14px}' +
// --- button ---
'button{width:100%;font-family:inherit;font-size:16px;font-weight:700;letter-spacing:.01em;background:var(--blue);color:#fff;border:0;border-radius:var(--radius-sm);min-height:50px;padding:.8rem;cursor:pointer;transition:background-color .12s,box-shadow .12s,transform .06s;box-shadow:0 2px 10px rgba(17,109,255,.28)}' +
'button:hover{background:var(--blue-deep);box-shadow:0 4px 16px rgba(17,109,255,.34)}' +
'button:active{transform:translateY(1px)}button:disabled{opacity:.6;cursor:default;box-shadow:none}' +
'button.cal-nav,button.cal-cell,button.picker-btn{box-shadow:none;letter-spacing:0}' +
'button.cal-nav:hover,button.cal-cell:hover,button.picker-btn:hover{box-shadow:none}' +
'.out{margin-top:14px;padding:12px 14px;border-radius:var(--radius-sm);font-size:14px}' +
'.out.err{background:#fdeced;border:1px solid #f3b4b8;color:#a31515}' +
'.hidden{display:none!important}' +
// --- confirmation screen ---
'.confirm{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)}' +
'.confirm-head{background:var(--blue);color:#fff;padding:24px 18px;text-align:center}' +
'.confirm-head .check{width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:26px;line-height:1}' +
'.confirm-head h2{font-size:21px;font-weight:800;color:#fff}' +
'.confirm-head p{font-size:14px;opacity:.94;margin-top:.3rem}' +
'.refbox{display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:14px}' +
'.refbox .reflabel{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.85}' +
'.refbox .ref{font-weight:800;font-size:17px;letter-spacing:.04em;background:rgba(0,0,0,.18);padding:.2rem .65rem;border-radius:7px}' +
'.confirm-body{padding:20px 18px}' +
'.confirm-body h3{font-size:14px;font-weight:700;margin:0 0 8px;color:var(--ink)}' +
'.recap{list-style:none;margin:0 0 18px}' +
'.recap li{display:flex;justify-content:space-between;gap:12px;padding:.5rem 0;border-top:1px solid var(--line);font-size:14px}' +
'.recap li:first-child{border-top:0}' +
'.recap .k{color:var(--ink-2)}.recap .v{text-align:right;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}' +
'.recap li.tot .v{font-weight:800;font-size:16px;color:var(--blue)}' +
'.recap li.dep .v{color:var(--blue-deep)}' +
'.next{background:var(--blue-soft);border:1px solid var(--blue-line);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:18px}' +
'.next ul{margin:.2rem 0 0;padding-left:1.1rem}.next li{font-size:13.5px;color:var(--ink-2);margin:.35rem 0}' +
'.next li strong{color:var(--ink);font-weight:600}' +
'.cal-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}' +
'.btn2{flex:1 1 11rem;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;min-height:46px;font-weight:700;font-size:14px;text-decoration:none;border-radius:var(--radius-sm);padding:.6rem 1rem;border:1.5px solid var(--blue);color:var(--blue);background:var(--card);transition:background-color .12s,color .12s}' +
'.btn2:hover{background:var(--blue);color:#fff}' +
'.confirm-foot{font-size:13.5px;color:var(--ink-2);text-align:center}' +
'.confirm-foot a{color:var(--blue);font-weight:700;white-space:nowrap}' +
'@media(max-width:30rem){.row{grid-template-columns:1fr}}' +
'@media(prefers-reduced-motion:reduce){*{transition-duration:1ms!important;animation-duration:1ms!important}}' +
'</style></head><body>' +
'<header class="topbar">' +
'<a class="mark" href="/" aria-label="' + biz.name + ' - home"><picture>' +
'<source srcset="/assets/triple-r-dump-nav.webp" type="image/webp">' +
'<img src="/assets/triple-r-dump-nav.png" alt="' + biz.name + '" width="454" height="88"></picture></a>' +
'<a class="backlink" href="/">&larr; Back to site</a>' +
'</header>' +
'<main class="wrap">' +
'<h1 id="pagetitle">Book Your ' + svcLabels[svc] + '</h1>' +
'<p class="sub">' + (biz.serviceArea || "") + ' &nbsp;&middot;&nbsp; <a href="' + telHref + '">' + phone + '</a></p>' +
// NOTE: form is novalidate - JS sets `required` only for UX hinting; the server
// (booking.js validate()) is the source of truth for validation.
'<form id="f" novalidate>' +
// ----- Account type FIRST (drives the whole form) -----
'<fieldset><legend>Who is this for?</legend><div class="acct" role="radiogroup" aria-label="Account type">' +
'<label class="ac-card"><input type="radio" name="account_type" value="residential" checked><span class="box"><span class="t">Residential</span><span class="d">Book &amp; pay online now</span></span></label>' +
'<label class="ac-card"><input type="radio" name="account_type" value="commercial"><span class="box"><span class="t">Commercial</span><span class="d">Request a quote - we&rsquo;ll reach out</span></span></label>' +
'</div></fieldset>' +
// =================== RESIDENTIAL (self-serve booking) ===================
'<div id="resi">' +
'<label class="f" id="servicewrap">Service<span class="cdd" id="cdd-service" data-cdd="service">' +
'<button type="button" class="cdd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="cdd-val"></span><span class="cdd-chev" aria-hidden="true"></span></button>' +
'<input type="hidden" name="service_type" value="' + svc + '">' +
'<ul class="cdd-pop" role="listbox" tabindex="-1" hidden></ul></span></label>' +
'<div data-svc="dumpster">' +
'<fieldset><legend>Bin size</legend><div class="opts sizes">' + sizeRadios + '</div></fieldset>' +
'<fieldset><legend>Rental length</legend><div class="opts lengths">' + tierRadios + '</div></fieldset>' +
'</div>' +
'<div data-svc="trailer" class="hidden">' +
'<label class="f">Rental days<input type="number" name="rental_days" min="1" max="14" step="1" value="1"></label>' +
'</div>' +
// No placeholder here on purpose: showing an example code ("MILITARY10") hands
// every visitor a string that is probably a REAL working discount.
'<label class="f">Promo code (optional)<input type="text" name="promo_code" autocomplete="off" autocapitalize="characters" spellcheck="false"><span class="mut" id="promomsg" style="display:block;margin-top:3px"></span></label>' +
'<div class="sumbox"><div class="sumrow"><span id="sumlabel">Select options</span><span id="sumsub">-</span></div>' +
'<div class="sumrow" id="sumdiscrow" style="display:none"><span id="sumdisclabel">Discount</span><span id="sumdisc">-</span></div>' +
'<div class="sumrow"><span>Utah sales tax</span><span id="sumtax">-</span></div>' +
'<div class="sumrow" id="sumdeprow" style="display:none"><span>Refundable deposit</span><span id="sumdep">-</span></div>' +
'<div class="sumrow tot"><span>Total</span><span id="sumtot">-</span></div></div>' +
'<div class="row"><label class="f">First name<input type="text" name="first_name"></label><label class="f">Last name<input type="text" name="last_name"></label></div>' +
'<label class="f">Email<input type="email" name="email"></label>' +
'<label class="f">Phone<input type="tel" name="phone"></label>' +
'<label class="f">Company (optional)<input type="text" name="company"></label>' +
'<div class="row">' +
'<label class="f">Delivery date<span class="picker" id="datepick">' +
'<button type="button" class="picker-btn" id="dateBtn" aria-haspopup="dialog" aria-expanded="false"><span id="dateBtnText" class="ph">Select a date</span><span class="cae" aria-hidden="true">&#128197;</span></button>' +
'<input type="hidden" name="delivery_date" id="deliveryDate">' +
'<div class="cal" id="calPop" role="dialog" aria-label="Choose delivery date" hidden>' +
'<div class="cal-top"><button type="button" class="cal-nav" id="calPrev" aria-label="Previous month">&#8249;</button>' +
'<span class="cal-title" id="calTitle"></span>' +
'<button type="button" class="cal-nav" id="calNext" aria-label="Next month">&#8250;</button></div>' +
'<div class="cal-dow"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>' +
'<div class="cal-grid" id="calGrid"></div></div></span></label>' +
'<label class="f">Preferred time (optional)<span class="cdd" id="cdd-time" data-cdd="time">' +
'<button type="button" class="cdd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="cdd-val"></span><span class="cdd-chev" aria-hidden="true"></span></button>' +
'<input type="hidden" name="delivery_time" value="">' +
'<ul class="cdd-pop" role="listbox" tabindex="-1" hidden></ul></span></label>' +
'</div>' +
'<p class="mut" id="weekendnote" style="display:none;margin:-6px 0 10px">Junk removal runs weekends only - pick a Saturday or Sunday.</p>' +
'<label class="f" id="dropwrap">Drop-off address<span class="ac-wrap"><input type="text" name="address" placeholder="Street, City" autocomplete="off">' +
'<ul class="ac-list" id="ac-address" role="listbox" hidden></ul></span></label>' +
'<div data-svc="dumpster">' +
'<label class="inline"><input type="checkbox" id="samepick" checked> Pick-up address same as drop-off</label>' +
'<label class="f hidden" id="pickwrap">Pick-up address<span class="ac-wrap"><input type="text" name="pickup_address" placeholder="Street, City" autocomplete="off">' +
'<ul class="ac-list" id="ac-pickup" role="listbox" hidden></ul></span></label>' +
'<label class="f">Ground condition at drop-off<span class="cdd" id="cdd-ground" data-cdd="ground">' +
'<button type="button" class="cdd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="cdd-val"></span><span class="cdd-chev" aria-hidden="true"></span></button>' +
'<input type="hidden" name="ground_condition" value="">' +
'<ul class="cdd-pop" role="listbox" tabindex="-1" hidden></ul></span></label>' +
'<fieldset><legend>Permit / HOA approval needed?</legend>' +
'<label class="inline"><input type="radio" name="permit_needed" value="yes"> Yes</label>' +
'<label class="inline"><input type="radio" name="permit_needed" value="no"> No</label>' +
'<label class="f hidden" id="permwrap" style="margin-top:8px">Can you obtain it before the bin arrives?<input type="text" name="permit_obtainable"></label></fieldset>' +
'</div>' +
'<div data-svc="binswitch" class="hidden">' +
'<label class="f">Existing booking ref (optional)<input type="text" name="existing_ref" placeholder="TRD-XXXXXX"></label>' +
'</div>' +
'<label class="f">Anything else? (optional)<textarea name="message"></textarea></label>' +
'<label class="terms"><input type="checkbox" name="agreed_terms"> <span>I agree to the <a href="/terms" target="_blank" rel="noopener">terms, return &amp; cancellation policies</a>, and to receiving service texts about my booking. Reply STOP to opt out.</span></label>' +
'</div>' +
// =================== COMMERCIAL (request a quote lead) ===================
'<div id="comm" class="hidden">' +
'<p class="leadnote">Tell us about the job and Joseph will reach out to set up your account and pricing. No payment now.</p>' +
'<label class="f">Company<input type="text" name="company_c" placeholder="Company / business name"></label>' +
'<label class="f">Contact name<input type="text" name="contact_name"></label>' +
'<div class="row"><label class="f">Phone<input type="tel" name="phone_c"></label><label class="f">Email<input type="email" name="email_c"></label></div>' +
'<label class="f">What do you need? (optional)<span class="cdd" id="cdd-comm" data-cdd="comm">' +
'<button type="button" class="cdd-btn" aria-haspopup="listbox" aria-expanded="false"><span class="cdd-val"></span><span class="cdd-chev" aria-hidden="true"></span></button>' +
'<input type="hidden" name="service_interest" value="">' +
'<ul class="cdd-pop" role="listbox" tabindex="-1" hidden></ul></span></label>' +
'<label class="f">Job site address<span class="ac-wrap"><input type="text" name="address_c" placeholder="Street, City" autocomplete="off">' +
'<ul class="ac-list" id="ac-address-c" role="listbox" hidden></ul></span></label>' +
'<label class="f">Timeframe / how long you need it<input type="text" name="timeframe" placeholder="e.g. ASAP, ~2 weeks next month"></label>' +
'<label class="f">Details<textarea name="details" placeholder="What you are clearing, size of job, any access notes..."></textarea></label>' +
'<label class="terms"><input type="checkbox" name="agreed_terms_c"> <span>I agree to the <a href="/terms" target="_blank" rel="noopener">terms</a> and to be contacted about my request, including by text. Reply STOP to opt out.</span></label>' +
'</div>' +
// Honeypot: off-screen, not tabbable, hidden from AT. Real customers never fill
// it; scripted spam fills every input it finds. Server rejects when non-empty.
'<div aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden">' +
'<label>Leave this field empty<input type="text" name="trd_hp" tabindex="-1" autocomplete="off"></label></div>' +
'<button type="submit" id="submitBtn">Book it</button></form>' +
'<div id="out" class="out hidden" role="alert"></div>' +
'<div id="confirm" class="hidden"></div>' +
'</main>' +
'<script>var PRICING=' + JSON.stringify(pricing) + ';var SVC_LABELS=' + JSON.stringify(svcLabels) + ';var BIZ=' + JSON.stringify(biz.name) + ';var PHONE=' + JSON.stringify(phone) + ';var TEL=' + JSON.stringify(telHref) + ';' +
'var CDD_SERVICE=' + JSON.stringify(serviceCdd) + ';var CDD_GROUND=' + JSON.stringify(groundCdd) + ';var CDD_COMM=' + JSON.stringify(commIntCdd) + ';(function(){' +
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
'var _t=new Date();var MINDATE=new Date(_t.getFullYear(),_t.getMonth(),_t.getDate()+1);var MAXDATE=new Date(_t.getFullYear(),_t.getMonth(),_t.getDate()+90);' +
'function fmtDisplay(iso){var p=String(iso).split("-");return MON3[(+p[1])-1]+" "+(+p[2])+", "+p[0];}' +
'function dateAllowed(y,m,d){var dt=new Date(y,m,d);if(dt<MINDATE||dt>MAXDATE)return false;if(curSvc()==="junk"){var wd=dt.getDay();if(wd!==0&&wd!==6)return false;}return true;}' +
// ---- service group show/hide + required hinting (residential) ----
'function setGroup(svc){[].forEach.call(resi.querySelectorAll("[data-svc]"),function(g){var on=g.getAttribute("data-svc")===svc;g.classList.toggle("hidden",!on);[].forEach.call(g.querySelectorAll("input,select,textarea"),function(el){el.disabled=!on;});});}' +
'function applyRequired(svc){' +
'["bin_size","rental_tier","ground_condition","permit_needed","rental_days","pickup_address","permit_obtainable","existing_ref"].forEach(function(n){[].forEach.call(f.querySelectorAll("[name=\\""+n+"\\"]"),function(el){el.required=false;});});' +
'if(acctType()!=="residential")return;' +
'if(svc==="dumpster"){[].forEach.call(f.querySelectorAll("[name=bin_size]"),function(el){el.required=true;});[].forEach.call(f.querySelectorAll("[name=rental_tier]"),function(el){el.required=true;});var gc=f.querySelector("[name=ground_condition]");if(gc)gc.required=true;[].forEach.call(f.querySelectorAll("[name=permit_needed]"),function(el){el.required=true;});}' +
'if(svc==="trailer"){var rd=f.querySelector("[name=rental_days]");if(rd)rd.required=true;}' +
'}' +
'function applyDateConstraints(svc){document.getElementById("weekendnote").style.display=(svc==="junk")?"block":"none";' +
'if(svc==="junk"&&selectedISO&&!isWeekendISO(selectedISO)){clearDate();}renderCal();}' +
'function switchSvc(svc){setGroup(svc);applyRequired(svc);applyDateConstraints(svc);' +
'document.getElementById("pagetitle").textContent="Book Your "+(SVC_LABELS[svc]||"");document.title="Book "+(SVC_LABELS[svc]||"")+" - "+BIZ;recalc();}' +
// ---- account-type switch: residential booking vs commercial lead ----
'function switchAcct(t){var isC=(t==="commercial");comm.classList.toggle("hidden",!isC);resi.classList.toggle("hidden",isC);' +
'[].forEach.call(resi.querySelectorAll("input,select,textarea"),function(el){el.disabled=isC;});' +
'[].forEach.call(comm.querySelectorAll("input,select,textarea"),function(el){el.disabled=!isC;});' +
'if(isC){document.getElementById("pagetitle").textContent="Request a Commercial Quote";document.title="Request a Quote - "+BIZ;btn.textContent="Send request";}' +
'else{btn.textContent="Book it";switchSvc(curSvc());}}' +
'function recalc(){var svc=curSvc();var lab=document.getElementById("sumlabel"),sub=document.getElementById("sumsub"),tx=document.getElementById("sumtax"),to=document.getElementById("sumtot");' +
'var depRow=document.getElementById("sumdeprow"),depEl=document.getElementById("sumdep");depRow.style.display="none";' +
'var discRow=document.getElementById("sumdiscrow");discRow.style.display="none";' +
'var p=null,label="",deposit=0;' +
'if(svc==="dumpster"){var s=sel("bin_size"),trr=sel("rental_tier");if(!s||!trr){lab.textContent="Select size + length";sub.textContent="-";tx.textContent="-";to.textContent="-";return;}p=PRICING.bins[s].prices[trr];label=PRICING.bins[s].label+" - "+PRICING.tiers[trr].label;}' +
'else if(svc==="trailer"){var days=parseInt(f.rental_days.value,10);var sd=PRICING.services.trailer;if(!days||days<sd.minDays||days>sd.maxDays){lab.textContent="Enter rental days ("+sd.minDays+"-"+sd.maxDays+")";sub.textContent="-";tx.textContent="-";to.textContent="-";return;}p=sd.dayRate_cents*days;label=money(sd.dayRate_cents)+"/day x "+days+" day"+(days>1?"s":"");deposit=sd.deposit_cents;}' +
'else if(svc==="junk"){p=PRICING.services.junk.flat_cents;label=(SVC_LABELS.junk||"Junk Removal")+" (flat)";}' +
'else if(svc==="binswitch"){p=PRICING.services.binswitch.flat_cents;label=(SVC_LABELS.binswitch||"Bin Switch")+" (flat)";}' +
'var disc=0;if(PROMO){disc=Math.min(p,Math.round(p*PROMO.pct/100));if(disc>0){discRow.style.display="";document.getElementById("sumdisclabel").textContent=PROMO.code+" ("+PROMO.pct+"% off)";document.getElementById("sumdisc").textContent="\\u2212"+money(disc);}}' +
'var tax=Math.round((p-disc)*PRICING.taxRate);lab.textContent=label;sub.textContent=money(p);tx.textContent=money(tax);to.textContent=money(p-disc+tax);' +
'if(deposit>0){depRow.style.display="";depEl.textContent=money(deposit)+" (refundable)";}}' +
// ---- promo code: live check against /api/promo; the server re-validates on booking ----
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
'function choose(i){if(i<0||i>=opts.length)return;hid.value=opts[i].value;paint();close();btn.focus();if(onChange)onChange(opts[i].value);}' +
'btn.addEventListener("click",function(e){e.stopPropagation();if(isOpen())close();else open();});' +
'btn.addEventListener("keydown",function(e){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();if(!isOpen()){open();}else{setActive(active+(e.key==="ArrowDown"?1:-1));}}else if(e.key==="Enter"||e.key===" "||e.key==="Spacebar"){e.preventDefault();if(!isOpen())open();else choose(active);}else if(e.key==="Escape"){if(isOpen()){e.stopPropagation();close();}}else if(e.key==="Tab"){if(isOpen())close();}});' +
'pop.addEventListener("keydown",function(e){if(e.key==="Escape"){e.stopPropagation();close();btn.focus();}});' +
'document.addEventListener("click",function(e){if(isOpen()&&!root.contains(e.target))close();});' +
'paint();return {set:set,get:function(){return hid.value;},close:close};}' +
// ---- custom calendar date picker (vanilla; month names; tomorrow..+90; junk=weekends) ----
'var selectedISO="";var viewY,viewM;var calPop=document.getElementById("calPop"),dateBtn=document.getElementById("dateBtn"),dateBtnText=document.getElementById("dateBtnText"),hidDate=document.getElementById("deliveryDate");' +
'function clearDate(){selectedISO="";hidDate.value="";dateBtnText.textContent="Select a date";dateBtnText.className="ph";}' +
'function setDate(iso){selectedISO=iso;hidDate.value=iso;dateBtnText.textContent=fmtDisplay(iso);dateBtnText.className="";}' +
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
'var CDD_TIME=[{value:"",label:"No preference"}];' +
'for(var _h=7;_h<=18;_h++){var _ampm=_h<12?"AM":"PM";var _hr=_h%12;if(_hr===0)_hr=12;[0,30].forEach(function(mm){if(_h===18&&mm===30)return;var disp=_hr+":"+pad(mm)+" "+_ampm;CDD_TIME.push({value:disp,label:disp});});}' +
// ---- instantiate the four custom dropdowns (service drives the form; others are plain value pickers) ----
'var cddService=makeCdd("cdd-service",CDD_SERVICE,"Select a service",function(v){switchSvc(v);});' +
'makeCdd("cdd-time",CDD_TIME,"No preference",null);' +
'makeCdd("cdd-ground",CDD_GROUND,"Select...",null);' +
'makeCdd("cdd-comm",CDD_COMM,"Not sure yet",null);' +
// ---- keyless address autocomplete (graceful) ----
'function attachAC(input,listId){var list=document.getElementById(listId);if(!input||!list)return;var t=null,active=-1,items=[],lastQ="";' +
'function close(){list.hidden=true;list.innerHTML="";active=-1;items=[];}' +
'function pick(it){input.value=it.label;close();input.dispatchEvent(new Event("input",{bubbles:true}));}' +
'function render(arr){items=arr;active=-1;if(!arr.length){close();return;}list.innerHTML="";arr.forEach(function(it,i){var li=document.createElement("li");li.className="ac-item";li.setAttribute("role","option");li.textContent=it.label;li.addEventListener("mousedown",function(e){e.preventDefault();pick(it);});list.appendChild(li);});list.hidden=false;}' +
'function setActive(n){var lis=list.querySelectorAll(".ac-item");if(!lis.length)return;active=(n+lis.length)%lis.length;lis.forEach(function(li,i){li.classList.toggle("ac-active",i===active);});}' +
'input.addEventListener("input",function(){var q=input.value.trim();if(t)clearTimeout(t);if(q.length<3){close();return;}if(q===lastQ)return;t=setTimeout(function(){lastQ=q;fetch("/api/geocode?q="+encodeURIComponent(q)).then(function(r){return r.ok?r.json():[];}).then(function(arr){if(input.value.trim()!==q)return;render(Array.isArray(arr)?arr:[]);}).catch(function(){close();});},250);});' +
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
'f.classList.add("hidden");out.classList.add("hidden");confirmEl.classList.remove("hidden");' +
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
'confirmEl.innerHTML=html;f.classList.add("hidden");out.classList.add("hidden");confirmEl.classList.remove("hidden");' +
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
// service_type is a hidden input driven by the custom Service dropdown (its onChange calls switchSvc) - no change event here.
'if(e.target.name==="permit_needed"){document.getElementById("permwrap").classList.toggle("hidden",e.target.value!=="yes");}' +
'if(e.target.id==="samepick"){document.getElementById("pickwrap").classList.toggle("hidden",e.target.checked);}' +
'recalc();});' +
'f.addEventListener("input",function(e){if(e.target.name==="rental_days")recalc();});' +
// ---- submit: branch on account type ----
'f.addEventListener("submit",async function(e){e.preventDefault();' +
'if(acctType()==="commercial"){return submitLead();}' +
'var svc=curSvc();' +
'if(svc==="junk"&&!isWeekendISO(hidDate.value)){out.className="out err";out.classList.remove("hidden");out.textContent="Junk removal is weekends only - pick a Saturday or Sunday.";return;}' +
'btn.disabled=true;out.className="out";out.classList.remove("hidden");out.textContent="Checking availability...";' +
'var data=Object.fromEntries(new FormData(f).entries());data.service_type=svc;data.account_type="residential";data.agreed_terms=f.agreed_terms.checked;data.sms_consent=f.agreed_terms.checked;' +
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
