export function activeElement(element) {
  const root = element.getRootNode();
  return root.activeElement ?? document.activeElement;
}
