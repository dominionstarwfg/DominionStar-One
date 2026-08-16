(() => {
  const search = document.getElementById("knowledgeSearch");
  const cards = [...document.querySelectorAll(".knowledge-card")];
  const buttons = [...document.querySelectorAll("[data-filter]")];
  const count = document.getElementById("knowledgeCount");
  const empty = document.getElementById("knowledgeEmpty");
  let activeFilter = "all";

  const apply = () => {
    const term = (search?.value || "").trim().toLowerCase();
    let visible = 0;

    cards.forEach(card => {
      const matchesTopic = activeFilter === "all" || card.dataset.topic === activeFilter;
      const text = `${card.dataset.title || ""} ${card.textContent}`.toLowerCase();
      const matchesSearch = !term || text.includes(term);
      const show = matchesTopic && matchesSearch;
      card.hidden = !show;
      if (show) visible += 1;
    });

    if (count) count.textContent = `${visible} resource${visible === 1 ? "" : "s"}`;
    if (empty) empty.hidden = visible !== 0;
  };

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter || "all";
      buttons.forEach(item => item.classList.toggle("active", item === button));
      apply();
    });
  });

  search?.addEventListener("input", apply);
  apply();
})();
