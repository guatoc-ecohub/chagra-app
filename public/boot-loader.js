      // Quita el pre-loader cuando React monta su primer render.
      (function () {
        var root = document.getElementById('root');
        var loader = document.getElementById('pre-loader');
        if (!root || !loader) return;
        var done = function () {
          loader.style.opacity = '0';
          setTimeout(function () { loader.remove(); }, 220);
        };
        var obs = new MutationObserver(function () {
          if (root.children.length > 0) {
            obs.disconnect();
            done();
          }
        });
        obs.observe(root, { childList: true });
      })();
