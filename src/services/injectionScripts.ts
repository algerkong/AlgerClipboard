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
        input: 'textarea, div[contenteditable="true"]',
        send: 'div[class*="send"] button, button[aria-label*="Send"], textarea ~ button',
      });
    case "qwen":
      return buildScript(escaped, "qwen", {
        input: 'textarea, div[contenteditable="true"]',
        send: 'button[class*="send"], button[aria-label*="Send"], textarea ~ button',
      });
    case "doubao":
      return buildScript(escaped, "doubao", {
        input: 'textarea, div[contenteditable="true"]',
        send: 'button[class*="send"], button[data-testid*="send"], textarea ~ button',
      });
    default:
      return buildScript(escaped, serviceId, {
        input: 'textarea, div[contenteditable="true"], [role="textbox"]',
        send: 'button[type="submit"], form button:last-of-type',
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

  function findElement(sels) {
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (el) return el;
    }
    return null;
  }

  function fillElement(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'input') {
      // Textarea / input: set value + dispatch input event for React
      var nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ) || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      );
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Contenteditable: use execCommand for framework compatibility
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    }
  }

  function clickSend() {
    var btn = findElement(sendSelectors);
    if (btn && !btn.disabled) {
      btn.click();
      console.log('AlgerClipboard: send button clicked');
    } else if (btn) {
      // Button found but disabled, retry once after short delay
      setTimeout(function() {
        var retryBtn = findElement(sendSelectors);
        if (retryBtn && !retryBtn.disabled) {
          retryBtn.click();
          console.log('AlgerClipboard: send button clicked (retry)');
        } else {
          console.warn('AlgerClipboard: send button still disabled');
        }
      }, 500);
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
      clickSend();
      console.log('AlgerClipboard: injection complete');
    }, 500);
  }

  tryInject();
})();`;
}
