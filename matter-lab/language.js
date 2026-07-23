(() => {
  const select = document.querySelector('#languageSelect');
  const labels = {
    en: { matter:'Matter', collider:'Collider', registry:'MODEL REGISTRY', selected:'SELECTED MODEL', parameters:'Parameters', language:'Interface language' },
    ru: { matter:'Материя', collider:'Коллайдер', registry:'РЕЕСТР МОДЕЛЕЙ', selected:'ВЫБРАННАЯ МОДЕЛЬ', parameters:'Параметры', language:'Язык интерфейса' },
    he: { matter:'חומר', collider:'מאיץ', registry:'מאגר מודלים', selected:'מודל נבחר', parameters:'פרמטרים', language:'שפת ממשק' }
  };
  function replaceStaticText(lang) {
    const t = labels[lang] || labels.en;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    select.setAttribute('aria-label', t.language);
    document.querySelector('#matterWorkspaceBtn span').textContent = t.matter;
    document.querySelector('#colliderWorkspaceBtn span').textContent = t.collider;
    document.querySelector('.catalog-panel .eyebrow').textContent = t.registry;
    document.querySelector('.inspector-head .eyebrow').textContent = t.selected;
    document.querySelector('#parameterControls').closest('.inspector-section').querySelector('h3').textContent = t.parameters;
    localStorage.setItem('qcd-neutrino-language', lang);
  }
  select.value = localStorage.getItem('qcd-neutrino-language') || 'en';
  select.addEventListener('change', () => replaceStaticText(select.value));
  replaceStaticText(select.value);
})();
