import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MAX_SUGGESTIONS = 10;

export default function FilterResourceTypeInput({ value, resources, onChange }) {
  const [draft, setDraft] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  const suggestions = useMemo(() => {
    const query = draft.trim().toLowerCase();
    if (!query) return [];

    return resources
      .filter(resource => resource.includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [draft, resources]);

  const trimmedDraft = draft.trim();
  const isKnown = !trimmedDraft || resources.includes(trimmedDraft);
  const showMenu = open && trimmedDraft.length > 0;

  function updateMenuPosition() {
    const input = inputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }

  useLayoutEffect(() => {
    if (!showMenu) {
      setMenuStyle(null);
      return;
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [showMenu, draft, suggestions.length]);

  function commit(next) {
    const normalized = String(next || '').trim();
    setDraft(normalized);
    onChange(normalized);
    setOpen(false);
  }

  useEffect(() => {
    function onDocumentMouseDown(event) {
      if (!rootRef.current?.contains(event.target)
        && !event.target.closest?.('.filter-type-suggestions-menu')) {
        setOpen(false);
        setDraft(value || '');
      }
    }

    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [value]);

  function handleInputChange(nextValue) {
    setDraft(nextValue);
    setOpen(true);

    const trimmed = nextValue.trim();
    if (!trimmed) {
      onChange('');
      return;
    }

    if (resources.includes(trimmed)) {
      onChange(trimmed);
      setOpen(false);
    }
  }

  function handleFocus(event) {
    setOpen(true);
    event.target.select();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && showMenu && suggestions.length > 0) {
      event.preventDefault();
      commit(suggestions[0]);
    }

    if (event.key === 'Escape') {
      setOpen(false);
      setDraft(value || '');
      inputRef.current?.blur();
    }
  }

  const menu = showMenu && menuStyle && createPortal(
    <ul
      className="filter-type-suggestions-menu"
      style={menuStyle}
      role="listbox"
    >
      {suggestions.length > 0 ? suggestions.map(resource => (
        <li key={resource}>
          <button
            type="button"
            role="option"
            aria-selected={resource === value}
            onMouseDown={event => {
              event.preventDefault();
              commit(resource);
            }}
          >
            {resource}
          </button>
        </li>
      )) : (
        <li className="filter-type-empty-item">No matching resource types</li>
      )}
    </ul>,
    document.body,
  );

  return (
    <div className="filter-type-combobox" ref={rootRef}>
      <input
        ref={inputRef}
        type="text"
        className={isKnown ? 'filter-builder-input' : 'filter-builder-input filter-builder-input--invalid'}
        value={draft}
        onChange={event => handleInputChange(event.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder="Type to search…"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={showMenu}
        aria-autocomplete="list"
      />
      {menu}
    </div>
  );
}
