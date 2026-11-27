export const SIDEBAR_TABS = [
  { id: 'metadata', label: 'Metadata' },
  { id: 'structures', label: 'Index' },
  { id: 'annotations', label: 'Notes' },
  { id: 'search', label: 'Search' },
  { id: 'map', label: 'Map' },
];

export function configureSidebarTabs(tabs) {
  if (tabs === undefined) return SIDEBAR_TABS.map(({ id }) => id);
  if (!Array.isArray(tabs) || !tabs.length ||
      tabs.some((tab) => !SIDEBAR_TABS.some(({ id }) => id === tab)) ||
      new Set(tabs).size !== tabs.length) {
    throw new TypeError('sidebarTabs must be a non-empty array of unique tab IDs: metadata, structures, annotations, search, map.');
  }
  return SIDEBAR_TABS.filter(({ id }) => tabs.includes(id)).map(({ id }) => id);
}
