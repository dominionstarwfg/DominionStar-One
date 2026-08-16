(() => {
  const questions = [
    ["If your income stopped tomorrow, what would continue supporting your family?",
     "A clear answer begins with understanding your savings, benefits, protection, and monthly needs."],
    ["What account do you have that may grow with favorable tax treatment?",
     "Different accounts have different tax rules, limits, and withdrawal conditions."],
    ["What plan do you have for college costs beyond student loans?",
     "Savings, scholarships, grants, work-study, and responsible borrowing can all play a role."],
    ["Who are you helping become a stronger leader?",
     "Leadership grows when knowledge, trust, and responsibility are passed to others."],
    ["What financial habits will your children learn by watching you?",
     "Children often learn first from what families practice, discuss, and repeat."],
    ["What decision today could make your family stronger five years from now?",
     "Long-term progress often begins with one clear and consistent action."]
  ];

  const q = document.getElementById("genesisDailyQuestion");
  const c = document.getElementById("genesisDailyContext");
  const next = document.getElementById("genesisNextQuestion");
  let index = Math.floor(Date.now() / 86400000) % questions.length;

  const show = () => {
    if (!q || !c) return;
    q.textContent = questions[index][0];
    c.textContent = questions[index][1];
  };
  show();
  next?.addEventListener("click", () => {
    index = (index + 1) % questions.length;
    show();
  });

  const result = document.getElementById("genesisGuideResult");
  const guide = {
    family: ['Begin with Financial Development.', '/financial-services/'],
    career: ['Begin with Career Development.', '/opportunity/'],
    leadership: ['Begin with Leadership Development.', '/leadership-development/']
  };
  document.querySelectorAll("[data-genesis-guide]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [label, href] = guide[btn.dataset.genesisGuide];
      result.innerHTML = `${label} <a href="${href}">Continue →</a>`;
    });
  });
})();
