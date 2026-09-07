(function () {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  const form = document.getElementById("order-form");
  if (!form) return;
  function summary() {
    const d = new FormData(form);
    const lines = ["ClearStack — Quote request"];
    for (const [k, label] of [
      ["name","Name"],["email","Email"],["phone","Phone"],["company","Company"],
      ["product_type","Deliverable"],["pages","Page count"],["intake_type","Intake type"],["purpose","Purpose"],["form_types","Document types"],
      ["want","What they want"],["special","Special instructions"],
      ["intake","Intake"],["delivery","Delivery"],["paper_fate","Paper after approve"],
      ["rush","Rush"],["pay_pref","Deposit method"],["notes","Notes"],["service","Package"],
      ["dropout","Drop-out"]
    ]) {
      const v = d.get(k);
      if (v) lines.push(label + ": " + v);
    }
    return lines.join("\n");
  }
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const box = document.getElementById("order-result");
    if (!box) return;
    box.hidden = false;
    box.querySelector("pre").textContent = summary();
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  const copyBtn = document.getElementById("copy-summary");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(summary());
        copyBtn.textContent = "Copied";
        setTimeout(() => { copyBtn.textContent = "Copy summary"; }, 2000);
      } catch (_) { copyBtn.textContent = "Select & copy below"; }
    });
  }
})();
