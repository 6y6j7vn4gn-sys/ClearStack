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
    const usb = document.getElementById("addon-usb").checked;
    const rush = document.getElementById("addon-rush").checked;
    const shred = document.getElementById("addon-shred").checked;
    const indexing = document.getElementById("addon-indexing").checked;
    const notes = (document.getElementById("order-notes").value || "").trim();
    const pay = (document.querySelector('input[name="pay"]:checked') || {}).value || "card";
    const name = (document.getElementById("cust-name").value || "").trim();
    const email = (document.getElementById("cust-email").value || "").trim();
    const phone = (document.getElementById("cust-phone").value || "").trim();
    return { pkgId, pkg, qty, usb, rush, shred, indexing, notes, pay, name, email, phone };
  }

  /**
   * Locked math:
   * - list = package (+ qty for Box) + paid add-ons + rush (+30% of subtotal before rush)
   * - USB free/auto on Multi (included, $0)
   * - Zelle: −15% off package total only; add-ons at list
   * - Cards deposit: 50% of list
   * - Zelle deposit: 50% of (package×0.85 + add-ons + rush on that base)
   */
  function compute(s) {
    const packageList = round2(s.pkg.price * s.qty);
    const usbIncluded = !!s.pkg.usbIncluded;
    const usbAuto = usbIncluded;
    const usbCharge = usbIncluded ? 0 : s.usb ? CFG.addons.usb.price : 0;
    const shredUnits = s.pkg.qtyEnabled ? s.qty : 1;
    const shredCharge = s.shred ? round2(CFG.addons.shred.pricePerBox * shredUnits) : 0;
    const addonsList = round2(usbCharge + shredCharge);
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

  function buildOrder(s, m, orderId) {
    return {
      orderId: orderId || genOrderId(),
      brand: CFG.brand,
      createdAt: new Date().toISOString(),
      customer: { name: s.name, email: s.email, phone: s.phone },
      package: {
        id: s.pkgId,
        name: s.pkg.name,
        unitPrice: s.pkg.price,
        qty: s.qty,
        lineTotal: m.packageList
      },
      addons: {
        usb: { selected: s.usb || m.usbAuto, includedFree: m.usbIncluded, charge: m.usbCharge },
        rush: { selected: s.rush, charge: m.rushCharge },
        shred: { selected: s.shred, units: m.shredUnits, charge: m.shredCharge },
        indexing: {
          selected: s.indexing,
          quoted: true,
          rate: CFG.addons.indexing.hourly,
          note: s.indexing ? "Custom indexing — $35/hr quoted after review" : null
        }
      },
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
        zelleDiscountPct: CFG.zelleDiscount,
        depositPct: CFG.depositPct
      }
    };
  }

  function summaryText(order) {
    const lines = [
      "ClearStack order " + order.orderId,
      "Paper in. Searchable book out.",
      "",
      "Customer: " + (order.customer.name || "—"),
      "Email: " + (order.customer.email || "—"),
      "Phone: " + (order.customer.phone || "—"),
      "",
      "Package: " + order.package.name + " × " + order.package.qty + " — " + money(order.package.lineTotal),
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
      "Custom indexing: " + (order.addons.indexing.selected ? "$35/hr quoted" : "No"),
      "",
      "Pay method: " + (order.payMethod === "zelle" ? "Zelle (−15% off package)" : "Visa/Mastercard (Stripe) — full list"),
      "List total: " + money(order.math.listTotal),
      order.payMethod === "zelle"
        ? "Zelle total (after −15% on package): " + money(order.math.zelleTotal)
        : null,
      "Deposit due (50%): " + money(order.math.depositDue),
      "",
      "Notes: " + (order.notes || "—"),
      "",
      "Confirm to: " + CFG.confirmTo,
      "Future From: " + CFG.confirmFromFuture
    ];
    return lines.filter((x) => x !== null).join("\n");
  }

  function renderCart() {
    const s = stateFromForm();
    const m = compute(s);

    const qtyWrap = document.getElementById("qty-wrap");
    if (qtyWrap) qtyWrap.hidden = !s.pkg.qtyEnabled;

    const usbEl = document.getElementById("addon-usb");
    const usbHint = document.getElementById("usb-hint");
    if (s.pkg.usbIncluded) {
      usbEl.checked = true;
      usbEl.disabled = true;
      if (usbHint) usbHint.textContent = "Included free on Multi — auto-selected";
    } else {
      usbEl.disabled = false;
      if (usbHint) usbHint.textContent = "+$25 encrypted USB";
    }

    const lines = document.getElementById("cart-lines");
    const bits = [];
    bits.push(
      "<div class=\"cart-line\"><span>" +
        s.pkg.short +
        (s.pkg.qtyEnabled ? " × " + s.qty : "") +
        "</span><strong>" +
        money(m.packageList) +
        "</strong></div>"
    );
    if (m.usbIncluded || s.usb) {
      bits.push(
        "<div class=\"cart-line\"><span>Encrypted USB" +
          (m.usbIncluded ? " (included)" : "") +
          "</span><strong>" +
          (m.usbCharge ? money(m.usbCharge) : "$0.00") +
          "</strong></div>"
      );
    }
    if (s.shred) {
      bits.push(
        "<div class=\"cart-line\"><span>Certified shred × " +
          m.shredUnits +
          "</span><strong>" +
          money(m.shredCharge) +
          "</strong></div>"
      );
    }
    if (s.rush) {
      bits.push(
        "<div class=\"cart-line\"><span>Rush +30%</span><strong>" +
          money(m.rushCharge) +
          "</strong></div>"
      );
    }
    if (s.indexing) {
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
      s.pay === "zelle" ? "Zelle rail — 50% of (list × 0.85 on package + add-ons)" : "Card rail — 50% of list";

    document.getElementById("pay-card-panel").hidden = s.pay !== "card";
    document.getElementById("pay-zelle-panel").hidden = s.pay !== "zelle";

    const stripeBtn = document.getElementById("btn-stripe");
    const link = (CFG.stripePaymentLinks && CFG.stripePaymentLinks[s.pkgId]) || "";
    if (link) {
      stripeBtn.textContent = "Pay deposit with card";
      stripeBtn.href = link;
      stripeBtn.removeAttribute("data-fallback");
    } else {
      stripeBtn.textContent = "Stripe link coming — request quote";
      const body = encodeURIComponent(
        "Hi ClearStack,\n\nI'd like to pay the card deposit for:\n\n" +
          summaryText(buildOrder(s, m, "(pending)")) +
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
    if (!s.name || !s.email) {
      const err = document.getElementById("shop-err");
      err.hidden = false;
      err.textContent = "Name and email are required to place / confirm the order.";
      document.getElementById("cust-name").focus();
      return;
    }
    document.getElementById("shop-err").hidden = true;
    const m = compute(s);
    const order = buildOrder(s, m);
    try {
      sessionStorage.setItem("clearstack_last_order", JSON.stringify(order));
    } catch (_) {}
    const q = new URLSearchParams({ id: order.orderId });
    window.location.href = "confirm.html?" + q.toString();
  }

  function copyZelleSummary() {
    const s = stateFromForm();
    const m = compute(s);
    const order = buildOrder(s, m, "(draft)");
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
    const m = compute(s);
    const order = buildOrder(s, m, "(draft)");
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
