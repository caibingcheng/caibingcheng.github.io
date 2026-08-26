(function () {
  function initSearchLoading(suffix) {
    var input = document.getElementById('search-input-' + suffix);
    var dropdown = document.getElementById('search-dropdown-' + suffix);
    if (!input || !dropdown) return;

    var panel = document.createElement('div');
    panel.className = 'search-loading-panel';
    panel.innerHTML =
      '<div class="search-loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>' +
      '<div class="search-loading-text">搜索中...</div>' +
      '<div class="search-skeleton">' +
      '<div class="search-skeleton-line" style="width:40%"></div>' +
      '<div class="search-skeleton-line" style="width:100%"></div>' +
      '<div class="search-skeleton-line" style="width:85%"></div>' +
      '</div>';
    dropdown.appendChild(panel);

    function ensurePanel() {
      if (!dropdown.querySelector('.search-loading-panel')) {
        dropdown.appendChild(panel);
      }
    }

    function show() {
      ensurePanel();
      panel.classList.add('active');
    }

    function hide() {
      panel.classList.remove('active');
    }

    input.addEventListener('input', function () {
      if (input.value.trim() !== '') show();
      else hide();
    });

    var autocompleteEvents = [
      'autocomplete:shown',
      'autocomplete:empty',
      'autocomplete:closed',
      'autocomplete:selected'
    ];
    autocompleteEvents.forEach(function (eventName) {
      input.addEventListener(eventName, hide);
    });

    var observer = new MutationObserver(function () {
      if (dropdown.querySelector('.suggestion, .search-empty')) {
        hide();
      }
      ensurePanel();
    });
    observer.observe(dropdown, { childList: true, subtree: true });
  }

  function init() {
    initSearchLoading('desktop');
    initSearchLoading('mobile');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
