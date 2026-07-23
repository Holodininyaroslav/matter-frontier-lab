const dictionary = {
  en: { back:"← Research Lab", language:"Language" },
  ru: { back:"← Исследовательская лаборатория", language:"Язык" },
  he: { back:"מעבדת המחקר ←", language:"שפה" }
};
const stored = localStorage.getItem('qcd-neutrino-language') || 'en';
const label = document.querySelector('#languageLabel');
const select = document.querySelector('#languageSelect');
function setLanguage(lang) {
  const strings = dictionary[lang] || dictionary.en;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  if (label) label.textContent = strings.language;
  const back = document.querySelector('#portalLink');
  if (back) back.textContent = strings.back;
  localStorage.setItem('qcd-neutrino-language', lang);
}
select.value = stored;
select.addEventListener('change', () => setLanguage(select.value));
setLanguage(stored);
