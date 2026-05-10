import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { DOCUMENT_CATEGORIES, type DocCategory } from './documentCategories';

interface DocumentCategoryDropdownProps {
  value: DocCategory;
  onChange: (value: DocCategory) => void;
}

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 6;
const DROPDOWN_WIDTH = 260;

export default function DocumentCategoryDropdown({ value, onChange }: DocumentCategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, openUpwards: false });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize accents for search
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filtered = DOCUMENT_CATEGORIES.filter((cat) =>
    normalize(cat.label).includes(normalize(query))
  );

  const selected = DOCUMENT_CATEGORIES.find((cat) => cat.value === value);

  // Calculate dropdown position from trigger button
  const recalcCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = ITEM_HEIGHT * VISIBLE_ITEMS + 58; // list + search bar
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpwards = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    setCoords({
      top: openUpwards
        ? rect.top + window.scrollY - dropdownHeight - 6
        : rect.bottom + window.scrollY + 6,
      left: Math.min(
        rect.right + window.scrollX - DROPDOWN_WIDTH,
        window.innerWidth - DROPDOWN_WIDTH - 8
      ),
      openUpwards,
    });
  }, []);

  const openDropdown = () => {
    recalcCoords();
    setOpen(true);
    setQuery('');
    setHighlighted(0);
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery('');
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return;
      closeDropdown();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const handler = () => recalcCoords();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, recalcCoords]);

  // Focus input when opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) {
        onChange(filtered[highlighted].value);
        closeDropdown();
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  };

  const maxListHeight = ITEM_HEIGHT * VISIBLE_ITEMS;

  const dropdown = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
          onKeyDown={handleKeyDown}
          className="bg-white rounded-2xl border border-neutral-200/70 overflow-hidden"
          style={{
            position: 'absolute' as const,
            top: coords.top,
            left: coords.left,
            width: DROPDOWN_WIDTH,
            zIndex: 99999,
            boxShadow: '0 4px 6px -2px rgba(0,0,0,0.05), 0 16px 40px -8px rgba(0,0,0,0.12)',
          }}
        >
          {/* Search input */}
          <div className="px-2.5 pt-2.5 pb-1.5 border-b border-neutral-100">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-50 border border-neutral-200/70 rounded-xl">
              <Search size={11} className="text-neutral-400 flex-shrink-0" strokeWidth={2} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar categoría…"
                className="flex-1 text-[12px] bg-transparent outline-none text-neutral-700 placeholder:text-neutral-400 min-w-0"
              />
            </div>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="overflow-y-auto py-1.5 px-1.5"
            style={{ maxHeight: maxListHeight }}
          >
            {filtered.length === 0 ? (
              <p className="text-center text-[12px] text-neutral-400 py-4">
                Sin resultados
              </p>
            ) : (
              filtered.map((cat, idx) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => {
                    onChange(cat.value);
                    closeDropdown();
                  }}
                  onMouseEnter={() => setHighlighted(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 rounded-xl text-[12px] transition-colors text-left ${
                    idx === highlighted
                      ? 'bg-neutral-100 text-neutral-900'
                      : value === cat.value
                      ? 'bg-neutral-50 text-neutral-900'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                  style={{
                    fontWeight: value === cat.value ? 500 : 400,
                    height: ITEM_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <span>{cat.label}</span>
                  {value === cat.value && (
                    <Check size={12} strokeWidth={2.25} className="text-neutral-900 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? closeDropdown() : openDropdown())}
        className="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 border border-neutral-200/80 rounded-full text-[12px] bg-white text-neutral-700 hover:border-neutral-300 transition-all cursor-pointer max-w-[180px]"
        style={{ fontWeight: 500 }}
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          size={11}
          strokeWidth={2}
          className={`text-neutral-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </>
  );
}
