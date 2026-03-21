// IDE Projects Plugin - Search and open recent projects from multiple IDEs
(function () {
  var api = window.AlgerPlugin.create("ide-projects");
  var cachedProjects = null;
  var cacheTime = 0;
  var CACHE_TTL = 30000;
  var ideIconCache = {}; // ide id -> data:image/png;base64,... or null
  var iconsLoaded = false;

  // Search keywords to find each IDE in the system app list.
  // Try multiple keywords per IDE to maximize matching chance.
  var ideSearchKeywords = {
    code: ["Visual Studio Code", "Code"],
    cursor: ["Cursor"],
    windsurf: ["Windsurf"],
    trae: ["Trae"],
    "trae-cn": ["Trae CN"],
    antigravity: ["Antigravity"],
    zed: ["Zed"],
  };

  function loadIdeIcons() {
    if (iconsLoaded) return Promise.resolve();

    // First trigger a scan to populate the app cache
    return api.invokeHost("scan_applications", {})
      .catch(function () { return []; })
      .then(function () {
        var ides = Object.keys(ideSearchKeywords);
        return Promise.all(ides.map(function (ideId) {
          if (ideIconCache[ideId]) return Promise.resolve();

          var keywords = ideSearchKeywords[ideId];
          // Try each keyword until we find an icon
          return tryKeywords(ideId, keywords, 0);
        }));
      })
      .then(function () {
        iconsLoaded = true;
      });
  }

  function tryKeywords(ideId, keywords, index) {
    if (index >= keywords.length) {
      ideIconCache[ideId] = ideIconCache[ideId] || null;
      return Promise.resolve();
    }
    return api.invokeHost("search_applications", { keyword: keywords[index] })
      .then(function (apps) {
        if (Array.isArray(apps)) {
          for (var i = 0; i < apps.length; i++) {
            if (apps[i].icon_base64) {
              ideIconCache[ideId] = "data:image/png;base64," + apps[i].icon_base64;
              return;
            }
          }
        }
        // Try next keyword
        return tryKeywords(ideId, keywords, index + 1);
      })
      .catch(function () {
        return tryKeywords(ideId, keywords, index + 1);
      });
  }

  function getProjects() {
    var now = Date.now();
    if (cachedProjects && now - cacheTime < CACHE_TTL) {
      return Promise.resolve(cachedProjects);
    }
    return api.invokeBackend("scan", {}).then(function (projects) {
      cachedProjects = projects;
      cacheTime = Date.now();
      return projects;
    });
  }

  function filterProjects(projects, query) {
    if (!query || !query.trim()) return projects;
    var terms = query.toLowerCase().split(/\s+/);
    return projects.filter(function (p) {
      var text = (p.name + " " + p.path + " " + p.ide_name + " " + (p.remote || "")).toLowerCase();
      return terms.every(function (t) { return text.indexOf(t) !== -1; });
    });
  }

  api.registerMode({
    id: "ide-projects",
    name: "IDE Projects",
    icon: "ph:folder-notch-open",
    placeholder: "Search recent IDE projects...",
    debounceMs: 100,

    onQuery: function (query) {
      return Promise.all([getProjects(), loadIdeIcons()]).then(function (results) {
        var projects = results[0];
        var filtered = filterProjects(projects, query);
        return filtered.slice(0, 20).map(function (p) {
          var isRemote = !!p.remote;
          var subtitle = p.ide_name;
          if (isRemote) subtitle += " [" + p.remote + "]";
          subtitle += "  \u00B7  " + p.path;

          // Use real app icon, fallback to Phosphor icon
          var icon = ideIconCache[p.ide] || "ph:folder-notch-open";

          return {
            id: JSON.stringify({ ide: p.ide, path: p.path, cli: p.cli, remote: p.remote || null }),
            title: p.name,
            subtitle: subtitle,
            icon: icon,
            badge: p.ide_name,
          };
        });
      }).catch(function (err) {
        console.error("IDE Projects scan failed:", err);
        return [];
      });
    },

    onSelect: function (result) {
      var data;
      try { data = JSON.parse(result.id); } catch (e) { return Promise.resolve(); }
      var openArgs = { cli: data.cli, path: data.path };
      if (data.remote) openArgs.remote = data.remote;
      return api.invokeBackend("open", openArgs).catch(function (err) {
        console.error("Failed to open project:", err);
      });
    },
  });
})();
