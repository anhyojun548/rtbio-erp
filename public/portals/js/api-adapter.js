/**
 * api-adapter.js
 * prototype JS 모듈들이 서버로 mutation 을 전송할 때 사용하는 공통 fetch helper.
 *
 * 로딩 순서: data.js → api-adapter.js → data-loader.js → 나머지 스크립트
 *
 * 사용법:
 *   const saved = await window.apiClient.post('/api/clients', payload);
 *   await window.apiClient.patch('/api/clients/' + id, updates);
 *   await window.apiClient.delete('/api/clients/' + id);
 *   const data  = await window.apiClient.get('/api/clients', { q: '검색어' });
 */
(function (global) {
  'use strict';

  function _handleResponse(r) {
    if (r.status === 401) {
      global.location.href = '/login';
      throw new Error('Unauthorized');
    }
    if (!r.ok) {
      return r.json()
        .catch(function () { return { error: r.statusText }; })
        .then(function (e) { throw new Error(e.error || String(r.status)); });
    }
    // 204 No Content
    if (r.status === 204) return Promise.resolve(null);
    return r.json();
  }

  global.apiClient = {
    /**
     * GET 요청. params 객체를 쿼리스트링으로 변환.
     * @param {string} path
     * @param {Object} [params]
     * @returns {Promise<any>}
     */
    get: function (path, params) {
      var url = params ? path + '?' + new URLSearchParams(params).toString() : path;
      return fetch(url, { credentials: 'same-origin' })
        .then(_handleResponse);
    },

    /**
     * POST 요청 (JSON body).
     * @param {string} path
     * @param {Object} body
     * @returns {Promise<any>}
     */
    post: function (path, body) {
      return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      }).then(_handleResponse);
    },

    /**
     * PATCH 요청 (JSON body).
     * @param {string} path
     * @param {Object} body
     * @returns {Promise<any>}
     */
    patch: function (path, body) {
      return fetch(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      }).then(_handleResponse);
    },

    /**
     * DELETE 요청. body 가 있으면 JSON 으로 전송.
     * @param {string} path
     * @param {Object} [body]
     * @returns {Promise<any>}
     */
    delete: function (path, body) {
      var opts = {
        method: 'DELETE',
        credentials: 'same-origin',
      };
      if (body) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
      }
      return fetch(path, opts).then(_handleResponse);
    },
  };

})(window);
