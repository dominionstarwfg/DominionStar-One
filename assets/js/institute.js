(() => {
  const questions = [
    ["What account do you have that may grow with favorable tax treatment?", "Different accounts have different tax rules. The useful question is not only what you own, but how it works."],
    ["If your income stopped tomorrow, what would continue supporting your household?", "Understanding your emergency savings, benefits, and protection resources is a practical first step."],
    ["What plan do you have for college costs beyond student loans?", "Planning early can create more choices through savings, scholarships, grants, and responsible borrowing."],
    ["Have you reviewed how your assets would transfer to the people you intend?", "Beneficiary designations, ownership, wills, trusts, and local law can all affect the result."],
    ["What skill are you developing today that could expand your opportunities tomorrow?", "Careers change, but communication, integrity, adaptability, and service remain valuable."],
    ["Could the work you do become a way to help families make better decisions?", "Meaningful work often begins where competence and service meet."]
  ];
  const q = document.getElementById("instituteDailyQuestion");
  const c = document.getElementById("instituteDailyContext");
  const b = document.getElementById("newInstituteQuestion");
  if (!q || !c) return;
  const show = index => {
    const item = questions[index % questions.length];
    q.textContent = item[0];
    c.textContent = item[1];
  };
  const dayIndex = Math.floor(Date.now() / 86400000);
  show(dayIndex);
  b?.addEventListener("click", () => show(Math.floor(Math.random() * questions.length)));
})();


document.addEventListener("DOMContentLoaded", () => {
  const result = document.getElementById("auroraGuideResult");
  document.querySelectorAll("[data-guide]").forEach(button => {
    button.addEventListener("click", () => {
      const type = button.dataset.guide;
      const map = {
        family: ["Start with the Family Financial Journey.", "/financial-services/"],
        career: ["Start with the Professional Growth Journey.", "/opportunity/"],
        curious: ["Begin with today's question, then explore both journeys.", "#question-gate"]
      };
      const [message, href] = map[type];
      result.innerHTML = `${message} <a href="${href}">Continue →</a>`;
    });
  });

  const revealTargets = document.querySelectorAll(
    ".journey-card,.learning-story,.career-question-grid article,.legacy-preview-grid article"
  );
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add("institute-revealed");
    });
  }, { threshold: 0.12 });
  revealTargets.forEach(el => observer.observe(el));
});
