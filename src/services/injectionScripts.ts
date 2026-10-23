/**
 * Per-service JavaScript injection scripts for AI website auto-fill and auto-submit.
 *
 * Each script is a self-retrying IIFE that:
 * 1. Polls for the input element (every 300ms, max 20 attempts = 6s)
 * 2. Fills content using execCommand (contenteditable) or value setter (textarea)
 * 3. Clicks the send button after a short delay
 */

export function getInjectionScript(serviceId: string, text: string): string {
  const escaped = JSON.stringify(text);

  switch (serviceId) {
    case "chatgpt":
      return buildScript(escaped, "chatgpt", {
        input:
          '#prompt-textarea, .ProseMirror, div[contenteditable="true"]',
        send: 'button[data-testid="send-button"], button[aria-label="Send prompt"], form button[type="submit"]',
      });
    case "claude":
      return buildScript(escaped, "claude", {
        input:
          'div.ProseMirror, div[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
        send: 'button[aria-label="Send Message"], button[aria-label="Send message"], fieldset button:last-child',
      });
    case "gemini":
      return buildScript(escaped, "gemini", {
        input:
          'div[contenteditable="true"], .ql-editor, rich-textarea div[contenteditable]',
        send: 'button[aria-label="Send message"], button.send-button, mat-icon-button[aria-label*="Send"]',
      });
    case "deepseek":
      return buildScript(escaped, "deepseek", {
        input: 'textarea[name="search"], textarea, div[contenteditable="true"]',
        send:
          'div[role="button"].ds-button--circle:not(.ds-button--disabled), div[role="button"][class*="ds-button--circle"]:not([class*="disabled"]), button[aria-label*="Send"], button[aria-label*="发送"], div[class*="send"] button, button[class*="send"], textarea ~ button, div[contenteditable="true"] ~ button',
      });
    case "qwen":
      return buildScript(escaped, "qwen", {
        input: 'textarea, div[contenteditable="true"]',
        send:
          'button[class*="send"], button[aria-label*="Send"], button[aria-label*="发送"], textarea ~ button, div[contenteditable="true"] ~ button',
      });
    case "doubao":
      return buildScript(escaped, "doubao", {
        input: 'textarea, div[contenteditable="true"]',
        send:
          'button[class*="send"], button[data-testid*="send"], button[aria-label*="Send"], button[aria-label*="发送"], textarea ~ button, div[contenteditable="true"] ~ button',
      });
    default:
      return buildScript(escaped, serviceId, {
        input: 'textarea, div[contenteditable="true"], [role="textbox"]',
        send:
          'button[type="submit"], button[aria-label*="Send"], button[aria-label*="发送"], form button:last-of-type',
      });
  }
}

interface Selectors {
  input: string;
  send: string;
}

function buildScript(
  escapedText: string,
  serviceId: string,
  selectors: Selectors,
): string {
  // Split the input selector chain so we can try each independently
  const inputSelectors = selectors.input
    .split(",")
    .map((s) => s.trim());
  const sendSelectors = selectors.send
    .split(",")
    .map((s) => s.trim());

  return `(function() {
  console.log('AlgerClipboard: injection started for ${serviceId}');
  var text = ${escapedText};
  var attempts = 0;
  var maxAttempts = 20;
  var inputSelectors = ${JSON.stringify(inputSelectors)};
  var sendSelectors = ${JSON.stringify(sendSelectors)};

  function isVisible(el) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    var style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function findElement(sels) {
    for (var i = 0; i < sels.length; i++) {
      var els = document.querySelectorAll(sels[i]);
      for (var j = 0; j < els.length; j++) {
        if (isVisible(els[j])) return els[j];
      }
    }
    return null;
  }

  function findSendButton(inputEl) {
    var selectors = sendSelectors.concat([
      'div[role="button"].ds-button--circle:not(.ds-button--disabled)',
      'div[role="button"][class*="ds-button--circle"]:not([class*="disabled"])',
    ]);
    var best = null;
    var bestDistance = Infinity;
    var inputRect = inputEl ? inputEl.getBoundingClientRect() : null;

    for (var i = 0; i < selectors.length; i++) {
      var candidates = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < candidates.length; j++) {
        var candidate = candidates[j];
        if (!isVisible(candidate)) continue;
        if (candidate.classList && candidate.classList.contains('ds-button--disabled')) continue;
        if (candidate.getAttribute && candidate.getAttribute('aria-disabled') === 'true') continue;

        var distance = 0;
        if (inputRect) {
          var rect = candidate.getBoundingClientRect();
          distance = Math.abs(rect.right - inputRect.right) + Math.abs(rect.bottom - inputRect.bottom);
        }
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
    }

    return best;
  }

  function fillElement(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'input') {
      // Textarea / input: set value + dispatch input event for React
      var proto = tag === 'textarea'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value');
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text,
      }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Contenteditable: select the editor's contents and insert text so
      // framework editors (ProseMirror/Lexical/React) receive an input event.
      el.focus();
      try {
        var selection = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('insertText', false, text);
      } catch (err) {
        el.textContent = text;
      }
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text,
      }));
    }
  }

  function clickSend(inputEl) {
    var btn = findSendButton(inputEl);
    if (btn) {
      btn.click();
      console.log('AlgerClipboard: send button clicked');
      return;
    }

    // Fallback: most chat UIs send on Enter. This is also more reliable than
    // guessing the send button's markup, which changes frequently.
    if (inputEl) {
      inputEl.focus();
      ['keydown', 'keypress', 'keyup'].forEach(function(type) {
        var ev = new KeyboardEvent(type, {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true,
        });
        try {
          Object.defineProperty(ev, 'keyCode', { get: function() { return 13; } });
          Object.defineProperty(ev, 'which', { get: function() { return 13; } });
        } catch (e) {}
        inputEl.dispatchEvent(ev);
      });
      console.log('AlgerClipboard: send button not found, pressed Enter');
    } else {
      console.warn('AlgerClipboard: send button not found');
    }
  }

  function tryInject() {
    attempts++;
    var el = findElement(inputSelectors);
    if (!el) {
      if (attempts < maxAttempts) {
        setTimeout(tryInject, 300);
      } else {
        console.error('AlgerClipboard: input element not found after ' + (maxAttempts * 300) + 'ms timeout');
      }
      return;
    }

    el.focus();
    fillElement(el);

    // Wait for framework to process, then click send
    setTimeout(function() {
      clickSend(el);
      console.log('AlgerClipboard: injection complete');
    }, 500);
  }

  tryInject();
})();`;
}
