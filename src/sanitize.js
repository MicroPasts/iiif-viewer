export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function sanitizeHtml(dirty) {
  if (!dirty) return '';
  const template = document.createElement('template');
  template.innerHTML = String(dirty);

  const allowedTags = new Set([
    'A', 'B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'SPAN', 'UL', 'OL', 'LI', 'SUB', 'SUP',
  ]);

  const walk = (node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.has(child.tagName)) {
          walk(child);
          child.replaceWith(...child.childNodes);
          continue;
        }

        for (const attr of Array.from(child.attributes)) {
          if (child.tagName === 'A' && attr.name.toLowerCase() === 'href') {
            const val = attr.value.trim();
            if (!/^(https?:|mailto:|\/|#)/i.test(val)) {
              child.removeAttribute(attr.name);
            }
          } else {
            child.removeAttribute(attr.name);
          }
        }

        if (child.tagName === 'A' && child.hasAttribute('href')) {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
          child.className = 'text-cyan-700 dark:text-cyan-400 hover:underline';
        }

        walk(child);
      }
    }
  };

  walk(template.content);
  return template.innerHTML;
}