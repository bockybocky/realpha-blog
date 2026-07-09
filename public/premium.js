// 卡片 spotlight：讓 --mx/--my 跟著游標，配合 CSS .entry::after 柔光
(function () {
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return; // 觸控裝置略過
  function bind(el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }
  document.querySelectorAll('.entry').forEach(bind);
})();
