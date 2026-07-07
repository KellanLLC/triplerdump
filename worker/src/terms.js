// Terms / policies page at /terms. Linked from the booking form's agreement checkbox.
// Content provided by the owner (Joseph) 2026-06-26 — transcribed verbatim.
export function renderTermsPage(S) {
  const biz = (S && S.business) || {};
  const phone = biz.phone || "801-564-3164";
  const email = biz.email || "Joseph.Rodrigues@triplerdump.com";
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Terms &amp; Policies - Triple R Dump</title>' +
    '<style>' +
    'body{margin:0;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0b1b2b;background:#f5f8fc}' +
    '.wrap{max-width:740px;margin:0 auto;padding:26px 18px 80px}' +
    'h1{font-size:26px;margin:0 0 2px}' +
    'h2{font-size:19px;margin:32px 0 8px;color:#0b54cc;border-bottom:1px solid #dde5ef;padding-bottom:5px}' +
    'h3{font-size:15px;margin:16px 0 2px;color:#0b1b2b}' +
    'p,li{color:#26384a}ul{margin:6px 0 10px;padding-left:22px}li{margin:4px 0}' +
    '.sub{color:#5a6b7d;font-size:14px;margin:0 0 8px}' +
    'a{color:#116DFF}.back{display:inline-block;margin-bottom:14px;font-weight:600;text-decoration:none;color:#5a6b7d}' +
    '.contact{background:#fff;border:1px solid #dde5ef;border-radius:12px;padding:16px 18px;margin-top:26px}' +
    '.contact div{margin:2px 0}' +
    '</style></head><body><main class="wrap">' +
    '<a class="back" href="/book">&larr; Back to booking</a>' +
    '<h1>Terms &amp; Policies</h1><p class="sub">Triple R Dump &middot; West Haven, UT</p>' +

    '<h2>Terms and Conditions</h2>' +
    '<h3>1. Rental Period and Fees</h3><ul>' +
    '<li><b>Standard Rental:</b> Typical rental periods last 7 days.</li>' +
    '<li><b>Extensions:</b> Additional days beyond the agreed period are generally billed at a daily rate of $50 per day.</li>' +
    '<li><b>Trip Fees:</b> A "Dry Run" or "Trip Fee" of $150 applies if the driver cannot deliver or pick up the dumpster due to obstructions (e.g., parked cars, locked gates, or overfilled containers).</li></ul>' +
    '<h3>2. Loading Requirements</h3><ul>' +
    '<li><b>Fill Line:</b> Debris must be level with the top rim of the dumpster. Loading items above the "Top Off" line is illegal for transport and may result in an immediate refusal to haul or an overfilling fee.</li>' +
    '<li><b>Weight Limits:</b> Each dumpster size includes a set weight allowance (e.g., 3 tons for a 15-yard bin, 4 tons for a 20-yard bin, 5 tons for a 25-yard bin). Overages are typically billed at $75 per ton.</li>' +
    '<li><b>Distribution:</b> Weight must be evenly distributed within the container to ensure safe transport.</li></ul>' +
    '<h3>3. Prohibited Materials</h3>' +
    '<p>Placement of the following hazardous or restricted items is strictly prohibited and will result in additional fines ($200 per item):</p><ul>' +
    '<li><b>Hazardous Waste:</b> Chemicals, asbestos, pesticides, herbicides, and radioactive material.</li>' +
    '<li><b>Liquids:</b> Wet paint, motor oil, fuels, and antifreeze.</li>' +
    '<li><b>Electronics:</b> TVs, monitors, computers, and batteries (especially lithium-ion).</li>' +
    '<li><b>Specialty Items:</b> Tires, mattresses, and appliances containing refrigerants (Freon) often require separate handling and extra fees.</li></ul>' +
    '<h3>4. Site Access and Property Damage</h3><ul>' +
    '<li><b>Clearance:</b> The customer must ensure at least 22 feet of overhead clearance (away from power lines/trees) and a clear path for the truck.</li>' +
    '<li><b>Surface Responsibility:</b> Roll-off trucks and full dumpsters are extremely heavy. The customer is responsible for any damage to driveways, pavement, lawns, or underground systems (septic/wells). Using protective boards on the driveway is highly recommended.</li>' +
    '<li><b>Permits:</b> If the dumpster is placed on a public street, the customer is responsible for obtaining any necessary city or HOA permits.</li></ul>' +
    '<h3>5. Liability and Payment</h3><ul>' +
    '<li><b>Ownership of Waste:</b> The customer retains title to and liability for all materials until they are legally disposed of at a licensed facility.</li>' +
    '<li><b>Payment Authorization:</b> By booking, the customer authorizes the company to charge the card on file for any weight overages, trip fees, or prohibited material fines discovered after pickup.</li></ul>' +

    '<h2>Return Policy</h2>' +
    '<h3>1. Cancellation &amp; Refund Policy</h3><ul>' +
    '<li><b>Before Dispatch:</b> Cancellations made at least 48 hours before the scheduled delivery date are eligible for a full refund.</li>' +
    '<li><b>After Dispatch:</b> Cancellations made after the truck has left our facility but before delivery are subject to a $150 cancellation fee.</li>' +
    '<li><b>After Delivery:</b> No refunds will be issued once the dumpster has been delivered to the site.</li></ul>' +
    '<h3>2. Rental Duration &amp; Extension</h3>' +
    '<p>Our standard rental period is 1-30 days (depending on how many days you ordered). If you need to keep the dumpster longer, please contact us at least 24 hours before the scheduled pickup to avoid automatic daily fee charges of $150 per day.</p>' +
    '<h3>3. Dump &amp; Return (Swap) Services</h3>' +
    '<p>If you fill your dumpster before your project is finished, you may request a swap. A swap involves picking up the full container and returning an empty one. This service is treated as a new rental, and the full original rental price will apply.</p>' +
    '<h3>4. Overloading &amp; Proper Loading</h3><ul>' +
    '<li><b>Fill Level:</b> Waste must be loaded level with the top rim of the dumpster. Do not exceed the top rail.</li>' +
    '<li><b>Tarping:</b> For safety, we cannot transport dumpsters that are overfilled. Drivers will not pick up overfilled containers, resulting in a Dry Run Fee of $200.</li>' +
    '<li><b>Weight Limits:</b> Exceeding the allowed weight capacity will result in overweight charges of $150 per ton.</li>' +
    '<li><b>Heavy Materials:</b> Concrete, dirt, brick, or sand must be in a small, designated container (e.g., 10-yard) to avoid exceeding weight limits.</li></ul>' +
    '<h3>5. Prohibited Items (No-Returns)</h3>' +
    '<p>The following items are prohibited and cannot be returned with the container. If found, these items will be removed at your expense, or additional penalties will apply:</p><ul>' +
    '<li>Hazardous waste, paints, chemicals, or liquids</li>' +
    '<li>Batteries, electronics, or appliances with Freon</li>' +
    '<li>Tires</li><li>Asbestos</li><li>Propane tanks / fuel</li></ul>' +
    '<h3>6. Property Damage &amp; Placement</h3><ul>' +
    '<li>We will make every effort to place the dumpster exactly where you want it. Our drivers are not responsible for damage to driveways, lawns, or sidewalks due to the weight of the truck/container.</li>' +
    '<li><b>Unauthorized Movement:</b> Do not attempt to move the dumpster after it is placed. Doing so may cause damage to the container or property, incurring additional fees.</li></ul>' +
    '<h3>7. Dry Run / Trip Fees</h3>' +
    '<p>A Dry Run Fee of $150 will be charged if the driver arrives for delivery or pickup but cannot complete the service due to: the container being blocked (e.g., by cars); the container being overfilled/incorrectly loaded; or the site not being prepared.</p>' +

    '<h2>Cancellation Policy</h2>' +
    '<h3>Late Cancellation Fee</h3>' +
    '<p>Orders cancelled within 3 hours of the scheduled drop-off time will be charged a $100 cancellation fee. To avoid this fee, please cancel at least 3 hours before your scheduled delivery.</p>' +
    '<p>For cancellations or changes, contact us at ' + email + ' or ' + phone + '.</p>' +

    '<div class="contact"><h2 style="margin-top:0">Contact Us</h2>' +
    '<div><b>Triple R Dump</b></div>' +
    '<div>Email: <a href="mailto:' + email + '">' + email + '</a></div>' +
    '<div>Phone: <a href="tel:' + String(phone).replace(/[^\d+]/g, "") + '">' + phone + '</a></div>' +
    '<div>Address: West Haven, UT, United States</div></div>' +

    '</main></body></html>';
}
