export type TabId = 'deals' | 'documents' | 'account'

const tabs: { id: TabId; icon: string; label: string }[] = [
  { id: 'deals', icon: '▤', label: 'DEALS' },
  { id: 'documents', icon: '◫', label: 'DOCUMENTS' },
  { id: 'account', icon: '◍', label: 'ACCOUNT' },
]

export function TabBar({
  active = 'deals',
  onSelect,
}: {
  active?: TabId
  onSelect?: (id: TabId) => void
}) {
  return (
    <nav className="tabbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className="tabbar__tab"
          data-active={active === tab.id ? 'true' : 'false'}
          onClick={() => onSelect?.(tab.id)}
        >
          <span className="tabbar__icon" aria-hidden="true">
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
