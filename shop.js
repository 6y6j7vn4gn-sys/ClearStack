(function () {
  const CFG = window.CLEARSTACK_SHOP;
  if (!CFG) return;

  const money = (n) =>
    "$" + (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function genOrderId() {
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return "CS-" + t.slice(-6) + r;
  }

  function stateFromForm() {
    const pkgId = (document.querySelector('input[name="package"]:checked') || {}).value || "starter";
    const pkg = CFG.packages[pkgId];
    let qty = 1;
    if (pkg && pkg.qtyEnabled) {
      qty = Math.max(1, parseInt(document.getElementById("box-qty").value, 10) || 1);
    }
    const intake = (document.querySelector('input[name="intake"]:checked') || {}).value || "kit";
    const kitSize = (document.getElementById("kit-size") || {}).value || "letter";
    const weightBand = (document.getElementById("weight-band") || {}).value || "5to10";
    const upsPickup = !!(document.getElementById("addon-ups-pickup") || {}).checked;
    // Van / operator drive NOT offered on public shop (legacy disabled).
    const vanMiles = null;
    const vanCity = null;
    const usb = document.getElementById("addon-usb").checked;
    const rush = document.getElementById("addon-rush").checked;
    const shred = document.getElementById("addon-shred").checked;
    const returnMail = !!(document.getElementById("addon-return-mail") || {}).checked;
    const indexing = document.getElementById("addon-indexing").checked;
    const notes = (document.getElementById("order-notes").value || "").trim();
    const pay = (document.querySelector('input[name="pay"]:checked') || {}).value || "zelle";
    const name = (document.getElementById("cust-name").value || "").trim();
    const email = (document.getElementById("cust-email").value || "").trim();
    const phone = (document.getElementById("cust-phone").value || "").trim();
    return {
      pkgId,
      pkg,
      qty,
      intake,
      kitSize,
      weightBand,
      upsPickup,
      vanMiles,
      vanCity,
      usb,
      rush,
      shred,
      returnMail,
      indexing,
      notes,
      pay,
      name,
      email,
      phone
    };
  }

  /**
   * Locked math:
   * - list = package (+ qty for Box) + paid add-ons (USB, shred, kit, ups-pickup, must-shipping, return-mail)
   *         + rush (+30% of subtotal before rush)
   * - USB free/auto on Multi (included, $0)
   * - Kit charge only when intake=kit
   * - ups-pickup only when checked and intake kit|ship (inbound door collect; default on)
   * - MUST shipping (hub→you): always on physical kit|ship|dropoff when outbound needed
   *     · kit-out always · return originals (default) · USB if ordered
   *     · shred = skip originals outbound; still charge for kit-out and/or USB
   *     · upload = $0 · estimate by kit band; final invoice = ceil(UPS×1.5) — never show markup
   * - return-mail only when not kit and not shred (kit includes labels; shred = no return)
   * - Zelle: −15% off package total only; add-ons + shipping at list (no Zelle discount on shipping)
   * - Cards deposit: 50% of list
   * - Zelle deposit: 50% of (package×0.85 + add-ons + rush on that base)
   * Never expose operator cost or 1.5× markup to clients.
   */
  function compute(s) {
    const packageList = round2(s.pkg.price * s.qty);
    const usbIncluded = !!s.pkg.usbIncluded;
    const usbAuto = usbIncluded;
    const usbCharge = usbIncluded ? 0 : s.usb ? CFG.addons.usb.price : 0;
    const shredUnits = s.pkg.qtyEnabled ? s.qty : 1;
    const shredCharge = s.shred ? round2(CFG.addons.shred.pricePerBox * shredUnits) : 0;

    const kitDef = (CFG.kits && CFG.kits[s.kitSize]) || null;
    const kitQuoted = !!(kitDef && kitDef.quoted);
    const kitCharge =
      s.intake === "kit" && kitDef && !kitQuoted ? round2(kitDef.price) : 0;

    const upsAllowed = s.intake === "kit" || s.intake === "ship";
    const upsPickupCharge =
      upsAllowed && s.upsPickup ? round2(CFG.addons.upsPickup.price) : 0;

    // Legacy van: never charge on public shop
    const vanMilesCharge = 0;

    // Shred = privacy dispose → no original paper return / no return-mail
    const returnMailAllowed = s.intake !== "kit" && !s.shred;
    const returnMailCharge =
      returnMailAllowed && s.returnMail ? round2(CFG.addons.returnMail.price) : 0;

    // Must shipping Task 1 DROP (hub → client). Weight band = primary cost indicator.
    const physical = s.intake === "kit" || s.intake === "ship" || s.intake === "dropoff";
    const weightDef =
      (CFG.weightBands && CFG.weightBands[s.weightBand]) ||
      (CFG.weightBands && CFG.weightBands["5to10"]) ||
      null;
    let mustShipCharge = 0;
    let mustShipQuoted = false;
    let mustShipEstimate = 0;
    let mustShipBand = null;
    let mustShipBandLabel = null;
    let mustShipNeeded = false;
    if (physical) {
      const usbWillShip = !!(s.usb || usbIncluded);
      const returnOriginals = !s.shred; // default paper fate
      const kitOut = s.intake === "kit";
      mustShipNeeded = kitOut || returnOriginals || usbWillShip;
      if (mustShipNeeded) {
        mustShipBand = weightDef ? weightDef.id : s.weightBand || "5to10";
        mustShipBandLabel = weightDef ? weightDef.label : mustShipBand;
        if (weightDef && weightDef.quoted) {
          mustShipQuoted = true;
          mustShipEstimate = 0;
          mustShipCharge = 0;
        } else {
          mustShipEstimate = Number(weightDef && weightDef.estimate != null ? weightDef.estimate : 28);
          mustShipCharge = round2(mustShipEstimate);
        }
      }
    }

    const addonsList = round2(
      usbCharge +
        shredCharge +
        kitCharge +
        upsPickupCharge +
        vanMilesCharge +
        returnMailCharge +
        mustShipCharge
    );
    const subBeforeRush = round2(packageList + addonsList);
    const rushCharge = s.rush ? round2(subBeforeRush * CFG.addons.rush.pct) : 0;
    const listTotal = round2(subBeforeRush + rushCharge);

    const packageZelle = round2(packageList * (1 - CFG.zelleDiscount));
    const zelleSubBeforeRush = round2(packageZelle + addonsList);
    const zelleRush = s.rush ? round2(zelleSubBeforeRush * CFG.addons.rush.pct) : 0;
    const zelleTotal = round2(zelleSubBeforeRush + zelleRush);

    const cardDeposit = round2(listTotal * CFG.depositPct);
    const zelleDeposit = round2(zelleTotal * CFG.depositPct);

    return {
      packageList,
      usbIncluded,
      usbAuto,
      usbCharge,
      shredCharge,
      shredUnits,
      kitCharge,
      kitQuoted: s.intake === "kit" && kitQuoted,
      kitLabel: kitDef ? kitDef.label : s.kitSize,
      upsPickupCharge,
      vanMilesCharge,
      returnMailCharge,
      mustShipCharge,
      mustShipQuoted,
      mustShipEstimate,
      mustShipBand,
      mustShipBandLabel,
      mustShipNeeded,
      addonsList,
      rushCharge,
      listTotal,
      packageZelle,
      zelleTotal,
      cardDeposit,
      zelleDeposit,
      depositDue: s.pay === "zelle" ? zelleDeposit : cardDeposit,
      orderTotal: s.pay === "zelle" ? zelleTotal : listTotal
    };
  }

  function operatorSopLines(s, m) {
    const lines = ["Operator SOP (labels / logistics — after deposit):"];
    lines.push("• TWO UPS TASKS: Task 1 DROP hub→client · Task 2 PICKUP client→ClearStack PMB/Upland receive. Both legs bill ceil(UPS×1.5).");
    if (s.intake === "kit") {
      lines.push(
        "• KIT-OUT: mail empty prepaid UPS kit carton (" +
          (m.kitLabel || s.kitSize) +
          ") + both UPS labels from Upland hub; client packs & drops (or UPS Pickup if selected)."
      );
    }
    if (s.intake === "ship" || (s.intake === "kit" && !s.upsPickup)) {
      lines.push("• RET / inbound: issue inbound UPS label from Upland hub after deposit; send tracking the hour it prints.");
    }
    if (m.upsPickupCharge > 0 || (s.upsPickup && (s.intake === "kit" || s.intake === "ship"))) {
      lines.push("• Task 2 PICKUP (ups-pickup $12 SKU): schedule UPS Pickup at client door → ClearStack PMB / Upland UPS Store receive.");
    }
    if (m.mustShipNeeded) {
      lines.push(
        "• Task 1 DROP must shipping (hub→client): bill ceil(UPS×1.5) after address — replace cart estimate" +
          (m.mustShipQuoted
            ? " (Quoted)"
            : " (cart estimate $" + (m.mustShipEstimate || 0) + ")") +
          ". Never show clients 150%/1.5×."
      );
    }
    if (s.shred) {
      lines.push("• Paper fate: CERTIFIED SHRED — skip return-originals on Task 1 DROP; bill shred $15/box; USB/cloud book may still DROP.");
    } else if (s.intake !== "upload") {
      lines.push("• Paper fate: RETURN ORIGINALS via Task 1 DROP (default) — must shipping applies.");
    }
    if (m.returnMailCharge > 0) {
      lines.push("• RET return-mail: issue return labels ($18) — originals mail-back after approval.");
    }
    if (s.intake === "dropoff") {
      lines.push("• Drop-off: Upland, CA 91786 hub (cash OK). Street only on UPS label / appointment — never on site.");
    }
    if (s.intake === "upload") {
      lines.push("• Upload: secure digital intake — no physical labels / must shipping $0.");
    }
    if (lines.length === 1) lines.push("• (no label rails for this intake)");
    return lines;
  }

  function buildOrder(s, m, orderId) {
    return {
      orderId: orderId || genOrderId(),
      brand: CFG.brand,
      createdAt: new Date().toISOString(),
      customer: { name: s.name, email: s.email, phone: s.phone },
      intake: s.intake,
      kitSize: s.intake === "kit" ? s.kitSize : null,
      weightBand: s.intake === "upload" ? null : s.weightBand,
      weightBandLabel:
        s.intake === "upload"
          ? null
          : (CFG.weightBands && CFG.weightBands[s.weightBand] && CFG.weightBands[s.weightBand].label) ||
            s.weightBand,
      upsPickup: !!(s.upsPickup && (s.intake === "kit" || s.intake === "ship")),
      vanMiles: null,
      vanCity: null,
      package: {
        id: s.pkgId,
        name: s.pkg.name,
        unitPrice: s.pkg.price,
        qty: s.qty,
        lineTotal: m.packageList
      },
      paperFate: s.shred ? "shred" : s.intake === "upload" ? "n/a" : "return-originals",
      addons: {
        usb: { selected: s.usb || m.usbAuto, includedFree: m.usbIncluded, charge: m.usbCharge },
        rush: { selected: s.rush, charge: m.rushCharge },
        shred: { selected: s.shred, units: m.shredUnits, charge: m.shredCharge },
        kit: {
          selected: s.intake === "kit",
          size: s.intake === "kit" ? s.kitSize : null,
          quoted: m.kitQuoted,
          charge: m.kitCharge
        },
        upsPickup: {
          selected: !!(s.upsPickup && (s.intake === "kit" || s.intake === "ship")),
          charge: m.upsPickupCharge
        },
        mustShipping: {
          selected: !!m.mustShipNeeded,
          label: (CFG.shipping && CFG.shipping.label) || "UPS shipping (hub → you)",
          estimate: m.mustShipEstimate,
          quoted: !!m.mustShipQuoted,
          band: m.mustShipBand,
          bandLabel: m.mustShipBandLabel,
          weightBand: s.intake === "upload" ? null : s.weightBand,
          charge: m.mustShipCharge,
          note: m.mustShipNeeded
            ? "Est. from weight · final after UPS rate, billed at listed shipping — operator: ceil(UPS×1.5)"
            : null
        },
        van: { selected: false, miles: null, city: null, charge: 0, note: "Not offered — hub automation + UPS Pickup" },
        returnMail: {
          selected: s.intake !== "kit" && !s.shred && s.returnMail,
          charge: m.returnMailCharge
        },
        indexing: {
          selected: s.indexing,
          quoted: true,
          rate: CFG.addons.indexing.hourly,
          note: s.indexing ? "Custom indexing — $35/hr quoted after review" : null
        }
      },
      operatorSop: operatorSopLines(s, m),
      notes: s.notes,
      payMethod: s.pay,
      math: {
        listTotal: m.listTotal,
        zellePackageAfterDiscount: m.packageZelle,
        zelleTotal: m.zelleTotal,
        cardDeposit: m.cardDeposit,
        zelleDeposit: m.zelleDeposit,
        depositDue: m.depositDue,
        orderTotal: m.orderTotal,
        kitCharge: m.kitCharge,
        upsPickupCharge: m.upsPickupCharge,
        mustShipCharge: m.mustShipCharge,
        mustShipEstimate: m.mustShipEstimate,
        vanMilesCharge: m.vanMilesCharge,
        returnMailCharge: m.returnMailCharge,
        zelleDiscountPct: CFG.zelleDiscount,
        depositPct: CFG.depositPct
      }
    };
  }

  function summaryText(order) {
    const intakeLabel =
      (CFG.intake && CFG.intake[order.intake] && CFG.intake[order.intake].label) || order.intake || "—";
    const lines = [
      "ClearStack order " + order.orderId,
      "Paper in. Searchable book out.",
      "",
      "Customer: " + (order.customer.name || "—"),
      "Email: " + (order.customer.email || "—"),
      "Phone: " + (order.customer.phone || "—"),
      "",
      "— PACKAGE / INTAKE —",
      "Package: " + order.package.name + " × " + order.package.qty + " — " + money(order.package.lineTotal),
      "Intake: " + intakeLabel,
      order.kitSize
        ? "Prepaid UPS kit: " +
          order.kitSize +
          (order.addons.kit.quoted ? " (Quoted)" : " — " + money(order.addons.kit.charge))
        : null,
      order.upsPickup ? "UPS Pickup at door (inbound): " + money(order.addons.upsPickup.charge) : "UPS Pickup: No",
      order.weightBandLabel
        ? "Weight band: " + order.weightBandLabel + (order.weightBand ? " (" + order.weightBand + ")" : "")
        : null,
      order.addons.mustShipping && order.addons.mustShipping.selected
        ? "UPS shipping (est. from weight): " +
          (order.addons.mustShipping.quoted
            ? "Quoted"
            : money(order.addons.mustShipping.charge) +
              " · final = after UPS rate, billed at our listed shipping") +
          " · operator: bill ceil(UPS×1.5)"
        : "UPS shipping (hub→you): $0 (upload / no outbound)",
      "Paper fate: " +
        (order.paperFate === "shred"
          ? "Certified shred for privacy (no original return)"
          : order.paperFate === "return-originals"
            ? "Return originals via UPS (default)"
            : "n/a"),
      "USB encrypted: " +
        (order.addons.usb.includedFree
          ? "Included (Multi)"
          : order.addons.usb.selected
            ? money(order.addons.usb.charge)
            : "No"),
      "Rush +30%: " + (order.addons.rush.selected ? money(order.addons.rush.charge) : "No"),
      "Certified shred: " +
        (order.addons.shred.selected
          ? money(order.addons.shred.charge) + " (" + order.addons.shred.units + " box unit(s))"
          : "No"),
      "Return-mail: " +
        (order.addons.returnMail.selected
          ? money(order.addons.returnMail.charge)
          : order.intake === "kit"
            ? "Included with prepaid UPS kit"
            : "No"),
      "Custom indexing: " + (order.addons.indexing.selected ? "$35/hr quoted" : "No"),
      "",
      "— PAY —",
      "Pay method: " + (order.payMethod === "zelle" ? "Zelle (−15% off package)" : "Visa/Mastercard (Stripe) — full list"),
      "List total: " + money(order.math.listTotal),
      order.payMethod === "zelle"
        ? "Zelle total (after −15% on package): " + money(order.math.zelleTotal)
        : null,
      "Deposit due (50%): " + money(order.math.depositDue),
      order.payMethod === "zelle"
        ? "Zelle memo: " + order.orderId + " · phone (626) 779-6345"
        : null,
      "",
      "— UPS / LABELS (TWO TASKS) —",
      "Hub: Upland, CA 91786 — street on UPS label PDF after deposit only (never on site / email body)",
      "Task 1 DROP hub→client · Task 2 PICKUP client→ClearStack PMB / Upland receive — both ceil(UPS×1.5)",
      order.kitSize ? "KIT-OUT prepaid UPS kit after deposit posts" : null,
      order.upsPickup ? "Task 2 PICKUP: schedule UPS at client door after deposit ($12) → Upland receive" : null,
      order.addons.mustShipping && order.addons.mustShipping.selected
        ? "Task 1 DROP must shipping — bill ceil(UPS×1.5); cart showed estimate"
        : null,
      order.intake === "ship" || (order.intake === "kit" && !order.upsPickup)
        ? "Issue inbound / RET label from Upland hub after deposit; tracking the hour it prints"
        : null,
      order.addons.returnMail && order.addons.returnMail.selected ? "Return-mail labels after approval" : null,
      order.paperFate === "shred" ? "SHRED — do not return originals" : null,
      "",
      "— PLAN (operator SOP) —",
      ...(order.operatorSop || []),
      "",
      "Notes: " + (order.notes || "—"),
      "",
      "Confirm to: " + CFG.confirmTo,
      "Future From: " + CFG.confirmFromFuture
    ];
    return lines.filter((x) => x !== null).join("\n");
  }

  /** Physical paths that need door collection: kit/ship intake, return originals later, USB ship-back. */
  function needsUpsCollection(s) {
    if (s.intake === "kit" || s.intake === "ship") return true;
    if (s.returnMail && (s.intake === "kit" || s.intake === "ship")) return true;
    if (s.usb && (s.intake === "kit" || s.intake === "ship")) return true;
    return false;
  }

  function ensureUpsPickupDefault(s) {
    const upsEl = document.getElementById("addon-ups-pickup");
    if (!upsEl) return;
    const upsAllowed = s.intake === "kit" || s.intake === "ship";
    if (!upsAllowed) return;
    // Keep UPS on for every physical collection path unless client explicitly unchecked.
    if (needsUpsCollection(s) && !upsEl.dataset.userTouched) {
      upsEl.checked = true;
    }
  }

  function syncIntakeUI(s) {
    const kitWrap = document.getElementById("kit-size-wrap");
    const upsWrap = document.getElementById("ups-pickup-wrap");
    const upsEl = document.getElementById("addon-ups-pickup");
    const returnEl = document.getElementById("addon-return-mail");
    const returnRow = document.getElementById("return-mail-row");
    const shredEl = document.getElementById("addon-shred");
    const fateReturn = document.getElementById("fate-return");
    const fateShred = document.getElementById("fate-shred");
    const mustShipNote = document.getElementById("must-ship-note");

    const weightWrap = document.getElementById("weight-band-wrap");
    const weightEl = document.getElementById("weight-band");

    if (kitWrap) kitWrap.hidden = s.intake !== "kit";
    if (upsWrap) upsWrap.hidden = !(s.intake === "kit" || s.intake === "ship");
    // Weight band required on physical intakes only (kit|ship|dropoff)
    if (weightWrap) {
      const needWeight = s.intake === "kit" || s.intake === "ship" || s.intake === "dropoff";
      weightWrap.hidden = !needWeight;
      if (weightEl) {
        weightEl.required = needWeight;
        weightEl.disabled = !needWeight;
      }
    }

    // Task 2 PICKUP (ups-pickup $12) for kit|ship only. Disabled for dropoff/upload. Van never offered.
    if (upsEl) {
      if (s.intake === "dropoff" || s.intake === "upload") {
        upsEl.checked = false;
        upsEl.disabled = true;
      } else {
        upsEl.disabled = false;
        if (!upsEl.dataset.userTouched) upsEl.checked = true;
      }
    }

    // Sync paper-fate radios ↔ shred checkbox (mutual: return originals vs shred)
    if (fateReturn && fateShred && shredEl) {
      if (s.intake === "upload") {
        fateReturn.checked = true;
        fateShred.checked = false;
        shredEl.checked = false;
        fateReturn.disabled = true;
        fateShred.disabled = true;
      } else {
        fateReturn.disabled = false;
        fateShred.disabled = false;
        if (shredEl.checked) {
          fateShred.checked = true;
          fateReturn.checked = false;
        } else {
          fateReturn.checked = true;
          fateShred.checked = false;
        }
      }
    }

    // return-mail only if not kit and not shred (kit includes labels; shred = no original return)
    if (returnEl) {
      if (s.intake === "kit" || s.shred || s.intake === "upload") {
        returnEl.checked = false;
        returnEl.disabled = true;
        if (returnRow) returnRow.hidden = true;
      } else {
        returnEl.disabled = false;
        if (returnRow) returnRow.hidden = false;
      }
    }

    if (mustShipNote) {
      if (s.intake === "upload") {
        mustShipNote.textContent = "Upload-only: no UPS Task 1 DROP shipping.";
      } else if (s.shred) {
        mustShipNote.textContent =
          "Shred selected — skip return-originals on Task 1 DROP. Must shipping still applies for prepaid kit-out and/or USB if ordered.";
      } else {
        mustShipNote.textContent =
          "Task 1 DROP (hub→you) shipping required. Pick a weight band — cart shows estimate; final after UPS rate on deposit invoice.";
      }
    }

    ensureUpsPickupDefault(s);
  }

  function renderCart() {
    const s = stateFromForm();
    syncIntakeUI(s);
    // Re-read after sync (ups/return may have been cleared)
    const s2 = stateFromForm();
    const m = compute(s2);

    const qtyWrap = document.getElementById("qty-wrap");
    if (qtyWrap) qtyWrap.hidden = !s2.pkg.qtyEnabled;

    const usbEl = document.getElementById("addon-usb");
    const usbHint = document.getElementById("usb-hint");
    if (s2.pkg.usbIncluded) {
      usbEl.checked = true;
      usbEl.disabled = true;
      if (usbHint) usbHint.textContent = "Included free on Multi — auto-selected";
    } else {
      usbEl.disabled = false;
      if (usbHint) usbHint.textContent = "+$27 encrypted USB";
    }

    const lines = document.getElementById("cart-lines");
    const bits = [];
    bits.push(
      "<div class=\"cart-line\"><span>" +
        s2.pkg.short +
        (s2.pkg.qtyEnabled ? " × " + s2.qty : "") +
        "</span><strong>" +
        money(m.packageList) +
        "</strong></div>"
    );

    const intakeShort =
      (CFG.intake && CFG.intake[s2.intake] && CFG.intake[s2.intake].short) || s2.intake;
    bits.push(
      "<div class=\"cart-line muted\"><span>Intake: " +
        intakeShort +
        "</span><strong></strong></div>"
    );

    if (s2.intake === "kit") {
      bits.push(
        "<div class=\"cart-line\"><span>Prepaid UPS kit (" +
          m.kitLabel +
          ")</span><strong>" +
          (m.kitQuoted ? "Quoted" : money(m.kitCharge)) +
          "</strong></div>"
      );
    }
    if (m.upsPickupCharge > 0) {
      bits.push(
        "<div class=\"cart-line\"><span>UPS Pickup at door (Task 2)</span><strong>" +
          money(m.upsPickupCharge) +
          "</strong></div>"
      );
    }
    if (m.mustShipNeeded) {
      bits.push(
        "<div class=\"cart-line\"><span>UPS shipping (est. from weight" +
          (m.mustShipBandLabel ? ": " + m.mustShipBandLabel : "") +
          ")" +
          (m.mustShipQuoted
            ? " — Quoted"
            : " — " + money(m.mustShipCharge) + " · final after UPS rate") +
          "</span><strong>" +
          (m.mustShipQuoted ? "Quoted" : money(m.mustShipCharge)) +
          "</strong></div>"
      );
    }
    if (!s2.shred && s2.intake !== "upload") {
      bits.push(
        "<div class=\"cart-line muted\"><span>Paper fate: return originals (Task 1 DROP)</span><strong></strong></div>"
      );
    }
    if (m.usbIncluded || s2.usb) {
      bits.push(
        "<div class=\"cart-line\"><span>Encrypted USB" +
          (m.usbIncluded ? " (included)" : "") +
          "</span><strong>" +
          (m.usbCharge ? money(m.usbCharge) : "$0.00") +
          "</strong></div>"
      );
    }
    if (s2.shred) {
      bits.push(
        "<div class=\"cart-line\"><span>Certified shred × " +
          m.shredUnits +
          "</span><strong>" +
          money(m.shredCharge) +
          "</strong></div>"
      );
    }
    if (m.returnMailCharge > 0) {
      bits.push(
        "<div class=\"cart-line\"><span>Return-mail</span><strong>" +
          money(m.returnMailCharge) +
          "</strong></div>"
      );
    }
    if (s2.rush) {
      bits.push(
        "<div class=\"cart-line\"><span>Rush +30%</span><strong>" +
          money(m.rushCharge) +
          "</strong></div>"
      );
    }
    if (s2.indexing) {
      bits.push(
        "<div class=\"cart-line\"><span>Custom indexing</span><strong>$35/hr quoted</strong></div>"
      );
    }
    lines.innerHTML = bits.join("");

    document.getElementById("cart-list-total").textContent = money(m.listTotal);
    document.getElementById("cart-zelle-total").textContent = money(m.zelleTotal);
    document.getElementById("cart-card-deposit").textContent = money(m.cardDeposit);
    document.getElementById("cart-zelle-deposit").textContent = money(m.zelleDeposit);

    const depositEl = document.getElementById("cart-deposit-due");
    depositEl.textContent = money(m.depositDue);
    document.getElementById("deposit-rail-label").textContent =
      s2.pay === "zelle" ? "Zelle rail — 50% of (list × 0.85 on package + add-ons)" : "Card rail — 50% of list";

    document.getElementById("pay-card-panel").hidden = s2.pay !== "card";
    document.getElementById("pay-zelle-panel").hidden = s2.pay !== "zelle";

    const stripeBtn = document.getElementById("btn-stripe");
    const link = (CFG.stripePaymentLinks && CFG.stripePaymentLinks[s2.pkgId]) || "";
    if (link) {
      stripeBtn.textContent = "Pay deposit with card";
      stripeBtn.href = link;
      stripeBtn.removeAttribute("data-fallback");
    } else {
      stripeBtn.textContent = "Stripe link coming — request quote";
      const body = encodeURIComponent(
        "Hi ClearStack,\n\nI'd like to pay the card deposit for:\n\n" +
          summaryText(buildOrder(s2, m, "(pending)")) +
          "\n\nPlease send a Stripe Payment Link.\n"
      );
      stripeBtn.href =
        "mailto:" +
        CFG.confirmTo +
        "?subject=" +
        encodeURIComponent("ClearStack card deposit — Stripe link coming") +
        "&body=" +
        body;
      stripeBtn.setAttribute("data-fallback", "1");
    }

    document.getElementById("zelle-instructions").textContent = CFG.zelle.instructions;
    document.getElementById("zelle-deposit-amt").textContent = money(m.zelleDeposit);
  }

  function placeOrder() {
    const s = stateFromForm();
    syncIntakeUI(s);
    const s2 = stateFromForm();
    if (!s2.name || !s2.email) {
      const err = document.getElementById("shop-err");
      err.hidden = false;
      err.textContent = "Name and email are required to place / confirm the order.";
      document.getElementById("cust-name").focus();
      return;
    }
    const needWeight =
      s2.intake === "kit" || s2.intake === "ship" || s2.intake === "dropoff";
    if (needWeight && !s2.weightBand) {
      const err = document.getElementById("shop-err");
      err.hidden = false;
      err.textContent = "Select an approximate weight band — it sets your UPS shipping estimate.";
      const wb = document.getElementById("weight-band");
      if (wb) wb.focus();
      return;
    }
    document.getElementById("shop-err").hidden = true;
    const m = compute(s2);
    const order = buildOrder(s2, m);
    try {
      sessionStorage.setItem("clearstack_last_order", JSON.stringify(order));
    } catch (_) {}
    const q = new URLSearchParams({ id: order.orderId });
    window.location.href = "confirm.html?" + q.toString();
  }

  function copyZelleSummary() {
    const s = stateFromForm();
    syncIntakeUI(s);
    const s2 = stateFromForm();
    const m = compute(s2);
    const order = buildOrder(s2, m, "(draft)");
    const text =
      CFG.zelle.instructions +
      "\nDeposit due: " +
      money(m.zelleDeposit) +
      "\nMemo: use your CS- order id after Place order\n\n" +
      summaryText(order);
    const btn = document.getElementById("btn-copy-zelle");
    navigator.clipboard.writeText(text).then(
      () => {
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.textContent = "Copy order summary";
        }, 2000);
      },
      () => {
        btn.textContent = "Select & copy below";
      }
    );
  }

  function mailtoZelleConfirm() {
    const s = stateFromForm();
    syncIntakeUI(s);
    const s2 = stateFromForm();
    const m = compute(s2);
    const order = buildOrder(s2, m, "(draft)");
    const body = encodeURIComponent(
      "Hi ClearStack,\n\nPlease confirm my Zelle deposit request.\n\n" +
        CFG.zelle.instructions +
        "\nDeposit: " +
        money(m.zelleDeposit) +
        "\n\n" +
        summaryText(order) +
        "\n\n(Future confirmations from " +
        CFG.confirmFromFuture +
        ")\n"
    );
    window.location.href =
      "mailto:" +
      CFG.confirmTo +
      "?subject=" +
      encodeURIComponent("ClearStack Zelle deposit confirmation request") +
      "&body=" +
      body;
  }

  // Paper fate mutual choice: return originals (default) vs shred for privacy
  function applyPaperFate(fate) {
    const shredEl = document.getElementById("addon-shred");
    const returnEl = document.getElementById("addon-return-mail");
    if (!shredEl) return;
    if (fate === "shred") {
      shredEl.checked = true;
      if (returnEl) {
        returnEl.checked = false;
      }
    } else {
      shredEl.checked = false;
    }
    renderCart();
  }
  document.querySelectorAll('input[name="paper-fate"]').forEach((el) => {
    el.addEventListener("change", () => applyPaperFate(el.value));
  });
  const shredInit = document.getElementById("addon-shred");
  if (shredInit) {
    shredInit.addEventListener("change", () => {
      applyPaperFate(shredInit.checked ? "shred" : "return");
    });
  }

  // Featured default: kit|ship + UPS Pickup ($12) Task 2; stay on unless user unchecks.
  document.querySelectorAll('input[name="intake"]').forEach((el) => {
    el.addEventListener("change", () => {
      const ups = document.getElementById("addon-ups-pickup");
      if (ups && (el.value === "kit" || el.value === "ship") && !ups.disabled) {
        if (!ups.dataset.userTouched) ups.checked = true;
      }
      renderCart();
    });
  });

  const upsElInit = document.getElementById("addon-ups-pickup");
  if (upsElInit) {
    upsElInit.addEventListener("change", () => {
      upsElInit.dataset.userTouched = "1";
      renderCart();
    });
  }

  // Physical add-ons (return originals later, USB ship-back): keep UPS on unless user unchecked.
  ["addon-return-mail", "addon-usb"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      const ups = document.getElementById("addon-ups-pickup");
      const intake = (document.querySelector('input[name="intake"]:checked') || {}).value;
      if (!ups || ups.disabled || ups.dataset.userTouched) return;
      if (el.checked && (intake === "kit" || intake === "ship")) ups.checked = true;
    });
  });

  document.querySelectorAll("#shop-form input, #shop-form select, #shop-form textarea").forEach((el) => {
    el.addEventListener("input", renderCart);
    el.addEventListener("change", renderCart);
  });

  document.getElementById("btn-place-order").addEventListener("click", (e) => {
    e.preventDefault();
    placeOrder();
  });
  document.getElementById("btn-copy-zelle").addEventListener("click", (e) => {
    e.preventDefault();
    copyZelleSummary();
  });
  document.getElementById("btn-mailto-zelle").addEventListener("click", (e) => {
    e.preventDefault();
    mailtoZelleConfirm();
  });

  // Prefill package from ?pkg=
  const params = new URLSearchParams(window.location.search);
  const pref = params.get("pkg");
  if (pref && CFG.packages[pref]) {
    const radio = document.querySelector('input[name="package"][value="' + pref + '"]');
    if (radio) radio.checked = true;
  }

  renderCart();
})();
