(function () {
  const searchConfig = window.config && window.config.search;
  if (!searchConfig || searchConfig.type !== 'pagefind') return;

  const origAutocomplete = window.autocomplete;
  if (!origAutocomplete) return;

  const maxResultLength = searchConfig.maxResultLength || 10;
  const stateMap = new Map();
  let pagefindPromise = null;

  const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightTerms = (text, query) => {
    if (!query || !text) return text;
    const terms = query.trim().split(/\s+/).filter((t) => t.length);
    if (!terms.length) return text;
    const pattern = new RegExp('(' + terms.map(escapeRegex).join('|') + ')', 'gi');
    return text.replace(pattern, '<em class="search-highlight">$1</em>');
  };

  window.autocomplete = function (selector, options, dataset) {
    if (dataset && dataset.name === 'search') {
      const m = typeof selector === 'string' ? selector.match(/#search-input-(desktop|mobile)/) : null;
      const suffix = m ? m[1] : 'default';
      let state = stateMap.get(suffix);
      if (!state) {
        state = { lastResultCount: 0, currentQuery: '' };
        stateMap.set(suffix, state);
      }

      dataset.source = function (query, callback) {
        state.currentQuery = query;
        const $loading = document.getElementById('search-loading-' + suffix);
        const $clear = document.getElementById('search-clear-' + suffix);

        const finish = (results, count) => {
          state.lastResultCount = count || 0;
          if ($loading) $loading.style.display = 'none';
          if ($clear) $clear.style.display = query === '' ? 'none' : 'inline';
          callback(results);
        };

        if ($loading) $loading.style.display = 'inline';
        if ($clear) $clear.style.display = 'none';

        const loadPagefind = async () => {
          if (!pagefindPromise) {
            pagefindPromise = import('/pagefind/pagefind.js');
          }
          return pagefindPromise;
        };

        loadPagefind()
          .then((pagefind) => {
            pagefind.debouncedSearch(query, {}, 300).then(async (queryResult) => {
              const results = [];
              if (!queryResult || !queryResult.results) {
                finish(results, 0);
                return;
              }
              let resultCount = 0;
              for (let i = 0; i < queryResult.results.length && results.length < maxResultLength; i++) {
                try {
                  const result = await queryResult.results[i].data();
                  if (/^\/\d{6}\//.test(result.url) && !/\.html?$/.test(result.url)) {
                    resultCount++;
                    const excerpt = result.excerpt || (result.sub_results && result.sub_results[0] && result.sub_results[0].excerpt) || '';
                    const subCount = (result.sub_results && result.sub_results.length) || 0;
                    results.push({
                      uri: result.url,
                      title: result.meta.title,
                      date: '',
                      context: excerpt,
                      sub: false,
                      subCount: subCount,
                    });
                    for (let j = 0; j < result.sub_results.length; j++) {
                      const sub = result.sub_results[j];
                      results.push({
                        uri: sub.url,
                        title: sub.title,
                        date: '',
                        context: sub.excerpt,
                        sub: true,
                      });
                    }
                    if (resultCount >= maxResultLength) break;
                  }
                } catch (err) {
                  // ignore
                }
              }
              finish(results.slice(0, maxResultLength), resultCount);
            }).catch((err) => {
              console.error('Pagefind search error:', err);
              finish([], 0);
            });
          })
          .catch((err) => {
            console.error('Pagefind load error:', err);
            finish([], 0);
          });
      };

      dataset.templates = {
        suggestion: ({ title, date, context, sub, subCount }) => {
          if (!sub) {
            const countBadge = subCount ? `<span class="suggestion-sub-count">${subCount} 个相关片段</span>` : '';
            return `<div class="suggestion-parent"><div class="suggestion-title-row"><span class="suggestion-title">${highlightTerms(title, state.currentQuery)}</span>${countBadge}</div>${context ? `<div class="suggestion-context">${context}</div>` : ''}</div>`;
          }
          return `<div class="suggestion-sub"><div class="suggestion-title">${highlightTerms(title, state.currentQuery)}</div><div class="suggestion-context">${context}</div></div>`;
        },
        empty: ({ query }) => `<div class="search-empty">${searchConfig.noResultsFound}: <span class="search-query">"${query}"</span></div>`,
        footer: () => {
          const countText = state.lastResultCount > 0 ? `找到约 ${state.lastResultCount} 条结果 · ` : '';
          return `<div class="search-footer">${countText}Search by <a href="https://pagefind.app/" rel="noopener noreffer" target="_blank">Pagefind</a></div>`;
        },
      };
    }

    return origAutocomplete.apply(this, arguments);
  };
})();
