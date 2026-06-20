// Standalone booking page at /book. Reads effective settings (S) so prices/caps
// reflect CMS edits. Includes SMS-consent (TCPA).
export function renderBookingPage(S) {
  const pricing = {
    taxRate: S.taxRate,
    bins: Object.fromEntries(Object.entries(S.bins).map(([k, b]) => [k, { label: b.label, prices: b.prices }])),
    tiers: Object.fromEntries(Object.entries(S.tiers).map(([k, t]) => [k, { label: t.label }])),
  };
  const sizeRadios = Object.entries(S.bins).map(([size, b]) =>
    '<label class="opt"><input type="radio" name="bin_size" value="' + size + '" required><span class="card"><b>' + b.label + '</b></span></label>'
  ).join("");
  const tierRadios = Object.entries(S.tiers).map(([t, v]) =>
    '<label class="opt"><input type="radio" name="rental_tier" value="' + t + '" required><span class="card"><b>' + v.label + '</b><span class="mut"> rental</span></span></label>'
  ).join("");
  const groundOpts = ['<option value="">Select...</option>'].concat(S.groundConditions.map((g) => '<option value="' + g + '">' + g + '</option>')).join("");

  return '<!DOCTYPE html><html lang="en"><head>' +
'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
'<title>Book a Dumpster - ' + S.business.name + '</title><style>' +
':root{--blue:#116DFF;--ink:#0b1b2b;--line:#dde5ef;--bg:#f5f8fc;--mut:#5a6b7d}' +
'*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg)}' +
'.wrap{max-width:600px;margin:0 auto;padding:22px 16px 64px}' +
'h1{font-size:27px;margin:4px 0}.sub{color:var(--mut);margin:0 0 20px}' +
'form{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px}' +
'fieldset{border:0;padding:0;margin:0 0 16px}legend{font-weight:700;margin-bottom:8px;padding:0}' +
'.opts{display:flex;gap:10px;flex-wrap:wrap}.opt{flex:1 1 30%}' +
'.opt input{position:absolute;opacity:0}.opt .card{display:block;text-align:center;border:2px solid var(--line);border-radius:10px;padding:12px 6px;cursor:pointer}' +
'.opt input:checked+.card{border-color:var(--blue);background:#eef4ff}.mut{color:var(--mut);font-weight:400;font-size:13px}' +
'label.f{display:block;margin:0 0 13px;font-weight:600}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
'input[type=text],input[type=tel],input[type=email],input[type=date],input[type=time],select,textarea{width:100%;margin-top:5px;padding:11px 12px;border:1px solid var(--line);border-radius:9px;font:inherit;font-weight:400}' +
'textarea{min-height:64px;resize:vertical}.inline{display:inline-flex;align-items:center;gap:6px;font-weight:500;margin-right:18px}' +
'.sumbox{background:#f0f5ff;border:1px solid #cfe0ff;border-radius:10px;padding:14px;margin:4px 0 16px}' +
'.sumrow{display:flex;justify-content:space-between;margin:2px 0}.sumrow.tot{font-weight:800;font-size:18px;border-top:1px solid #cfe0ff;margin-top:6px;padding-top:6px}' +
'.consent{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--mut);margin:6px 0}.terms{display:flex;gap:8px;align-items:flex-start;font-size:14px;margin:6px 0 14px}' +
'button{width:100%;background:var(--blue);color:#fff;border:0;border-radius:10px;padding:14px;font-size:16px;font-weight:700;cursor:pointer}button:disabled{opacity:.6}' +
'.out{margin-top:16px;padding:14px;border-radius:10px;font-size:15px}.out.ok{background:#e9f9ee;border:1px solid #9be0b3}.out.err{background:#fdeced;border:1px solid #f3b4b8}.hidden{display:none}' +
'</style></head><body><main class="wrap">' +
'<h1>Book a Dumpster</h1><p class="sub">' + S.business.serviceArea + ' | dump fees included | ' + S.business.phone + '</p>' +
'<form id="f">' +
'<fieldset><legend>Bin size</legend><div class="opts">' + sizeRadios + '</div></fieldset>' +
'<fieldset><legend>Rental length</legend><div class="opts">' + tierRadios + '</div></fieldset>' +
'<div class="sumbox"><div class="sumrow"><span id="sumlabel">Select size + length</span><span id="sumsub">-</span></div>' +
'<div class="sumrow"><span>Utah sales tax</span><span id="sumtax">-</span></div><div class="sumrow tot"><span>Total</span><span id="sumtot">-</span></div></div>' +
'<div class="row"><label class="f">First name<input type="text" name="first_name" required></label><label class="f">Last name<input type="text" name="last_name" required></label></div>' +
'<div class="row"><label class="f">Email<input type="email" name="email" required></label><label class="f">Phone<input type="tel" name="phone" required></label></div>' +
'<label class="f">Company (optional)<input type="text" name="company"></label>' +
'<div class="row"><label class="f">Delivery date<input type="date" name="delivery_date" required></label><label class="f">Preferred time (optional)<input type="time" name="delivery_time"></label></div>' +
'<label class="f">Drop-off address<input type="text" name="address" placeholder="Street, City" required></label>' +
'<label class="inline"><input type="checkbox" id="samepick" checked> Pick-up address same as drop-off</label>' +
'<label class="f hidden" id="pickwrap">Pick-up address<input type="text" name="pickup_address" placeholder="Street, City"></label>' +
'<label class="f">Ground condition at drop-off<select name="ground_condition" required>' + groundOpts + '</select></label>' +
'<fieldset><legend>Permit / HOA approval needed?</legend>' +
'<label class="inline"><input type="radio" name="permit_needed" value="yes" required> Yes</label>' +
'<label class="inline"><input type="radio" name="permit_needed" value="no"> No</label>' +
'<label class="f hidden" id="permwrap" style="margin-top:8px">Can you obtain it before the bin arrives?<input type="text" name="permit_obtainable"></label></fieldset>' +
'<fieldset><legend>Account</legend>' +
'<label class="inline"><input type="radio" name="account_type" value="residential" checked> Residential - pay online</label>' +
'<label class="inline"><input type="radio" name="account_type" value="commercial"> Commercial - invoice me</label></fieldset>' +
'<label class="f">Anything else? (optional)<textarea name="message"></textarea></label>' +
'<label class="terms"><input type="checkbox" name="agreed_terms" required> I agree to the terms, return and cancellation policies.</label>' +
'<label class="consent"><input type="checkbox" name="sms_consent"> I agree to receive booking &amp; service texts at the number provided. Msg/data rates may apply; reply STOP to opt out.</label>' +
'<button type="submit">Book it</button></form><div id="out" class="out hidden"></div></main>' +
'<script>var PRICING=' + JSON.stringify(pricing) + ';(function(){' +
'var f=document.getElementById("f"),out=document.getElementById("out"),btn=f.querySelector("button");' +
'var t=new Date();t.setDate(t.getDate()+1);f.delivery_date.min=t.toISOString().slice(0,10);' +
'function money(c){return "$"+(c/100).toFixed(2);}' +
'function sel(n){var el=f.querySelector("input[name=\\""+n+"\\"]:checked");return el?el.value:"";}' +
'function recalc(){var s=sel("bin_size"),tr=sel("rental_tier");var lab=document.getElementById("sumlabel"),sub=document.getElementById("sumsub"),tx=document.getElementById("sumtax"),to=document.getElementById("sumtot");' +
'if(!s||!tr){lab.textContent="Select size + length";sub.textContent="-";tx.textContent="-";to.textContent="-";return;}' +
'var p=PRICING.bins[s].prices[tr];var tax=Math.round(p*PRICING.taxRate);' +
'lab.textContent=PRICING.bins[s].label+" - "+PRICING.tiers[tr].label;sub.textContent=money(p);tx.textContent=money(tax);to.textContent=money(p+tax);}' +
'f.addEventListener("change",function(e){recalc();' +
'if(e.target.name==="permit_needed"){document.getElementById("permwrap").classList.toggle("hidden",e.target.value!=="yes");}' +
'if(e.target.id==="samepick"){document.getElementById("pickwrap").classList.toggle("hidden",e.target.checked);}});' +
'f.addEventListener("submit",async function(e){e.preventDefault();btn.disabled=true;out.className="out";out.classList.remove("hidden");out.textContent="Checking availability...";' +
'var data=Object.fromEntries(new FormData(f).entries());data.agreed_terms=f.agreed_terms.checked;data.sms_consent=f.sms_consent.checked;' +
'if(document.getElementById("samepick").checked){data.pickup_address=data.address;}' +
'try{var r=await fetch("/api/book",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data)});var j=await r.json();' +
'if(!j.ok){out.className="out err";out.innerHTML="<b>Could not book:</b><br>"+((j.errors||[j.error])||[]).join("<br>");btn.disabled=false;return;}' +
'if(j.checkout_url){window.location=j.checkout_url;return;}' +
'out.className="out ok";out.innerHTML="<b>Booked - ref "+j.booking.id+"</b><br>"+j.message+"<br>"+j.booking.bin_size+"yd "+j.booking.rental_tier+"day - drop "+j.booking.delivery_date+" - pickup "+j.booking.pickup_date+"<br>Total "+money(j.booking.amount_cents);f.reset();recalc();}' +
'catch(err){out.className="out err";out.textContent="Network error - try again.";}btn.disabled=false;});recalc();})();' +
'</script></body></html>';
}
