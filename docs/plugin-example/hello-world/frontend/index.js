(function () {
  "use strict";

  const api = window.AlgerPlugin.create("hello-world");

  api.registerSpotlightMode("hello", {
    name: "Hello World",
    icon: "lucide:hand",
    placeholder: "Type something to echo...",

    onQuery(query) {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const text = query.trim();
      const reversed = text.split("").reverse().join("");
      const uppercased = text.toUpperCase();

      return [
        {
          id: "echo-original",
          title: text,
          description: "Original text",
          icon: "lucide:message-circle",
        },
        {
          id: "echo-reversed",
          title: reversed,
          description: "Reversed text",
          icon: "lucide:arrow-right-left",
        },
        {
          id: "echo-uppercase",
          title: uppercased,
          description: "Uppercase text",
          icon: "lucide:a-large-small",
        },
      ];
    },

    onSelect(result) {
      api.copyToClipboard(result.title);
    },
  });
})();
