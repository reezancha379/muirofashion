import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Edit2, Tag, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Lookbook, Product, ProductCategory } from '@/types';

interface CategoryManagerProps {
  categories: ProductCategory[];
  products: Product[];
  lookbooks: Lookbook[];
  onChanged: (categories: ProductCategory[]) => void;
}

function toSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function assignedCount(label: string, records: Array<{ category: string }>): number {
  const normalized = label.trim().toLocaleLowerCase();
  return records.filter(record => record.category.trim().toLocaleLowerCase() === normalized).length;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ categories, products, lookbooks, onChanged }) => {
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const clearForm = () => {
    setEditing(null);
    setName('');
    setSlug('');
    setDescription('');
    setSlugTouched(false);
  };

  const beginEdit = (category: ProductCategory) => {
    setEditing(category);
    setName(category.name);
    setSlug(category.slug);
    setDescription(category.description || '');
    setSlugTouched(true);
    setError('');
    setNotice('');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('muiro-category-form')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    document.getElementById('muiro-category-name')?.focus({ preventScroll: true });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = { name: name.trim(), slug: (slug || toSlug(name)).trim(), description: description.trim() };
      if (editing) await api.updateCategory(editing.id, payload);
      else await api.createCategory(payload);
      onChanged(await api.getCategories());
      setNotice(editing ? 'Category updated.' : 'Category created.');
      clearForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: ProductCategory) => {
    const productCount = assignedCount(category.name, products);
    const lookbookCount = assignedCount(category.name, lookbooks);
    if (productCount + lookbookCount > 0) {
      setError(`“${category.name}” is assigned to ${productCount} product${productCount === 1 ? '' : 's'} and ${lookbookCount} lookbook${lookbookCount === 1 ? '' : 's'}. Reassign content before deleting this category.`);
      setNotice('');
      return;
    }
    if (!window.confirm(`Delete the “${category.name}” category? This cannot be undone.`)) return;
    setDeletingId(category.id);
    setError('');
    setNotice('');
    try {
      await api.deleteCategory(category.id);
      onChanged(await api.getCategories());
      if (editing?.id === category.id) clearForm();
      setNotice('Category deleted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this category.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section aria-labelledby="category-manager-title">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 id="category-manager-title" className="text-xl font-bold text-[#181512]">Product Categories</h2>
          <p className="mt-1 text-xs text-[#6e6761]">Create and maintain categories used by products and lookbooks. Renaming a category updates content already assigned to it.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#e8e2dc] bg-white px-3 py-2 text-xs font-semibold text-[#6e6761]">
          <Tag className="h-4 w-4" aria-hidden="true" />
          {categories.length} {categories.length === 1 ? 'category' : 'categories'} · {products.length} products · {lookbooks.length} lookbooks
        </div>
      </div>

      {notice && <p role="status" aria-live="polite" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{notice}</p>}
      {error && <p role="alert" aria-live="assertive" className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}</p>}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <form id="muiro-category-form" onSubmit={handleSave} className="rounded-2xl border border-[#e8e2dc] bg-white p-5 shadow-sm sm:p-6">
          <h3 className="mb-4 text-base font-bold text-[#181512]">{editing ? 'Edit category' : 'Create a category'}</h3>
          <label htmlFor="muiro-category-name" className="mb-1 block text-xs font-semibold uppercase text-[#6e6761]">Category name</label>
          <input
            id="muiro-category-name"
            required
            maxLength={60}
            value={name}
            onChange={event => {
              const value = event.target.value;
              setName(value);
              if (!slugTouched) setSlug(toSlug(value));
            }}
            placeholder="e.g. Tailored outerwear"
            className="mb-4 w-full rounded-lg border border-[#e8e2dc] bg-[#fcfbf9] p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#181512]/20"
          />

          <label htmlFor="muiro-category-slug" className="mb-1 block text-xs font-semibold uppercase text-[#6e6761]">URL slug</label>
          <input
            id="muiro-category-slug"
            required
            maxLength={64}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={event => { setSlug(event.target.value); setSlugTouched(true); }}
            placeholder="tailored-outerwear"
            aria-describedby="muiro-category-slug-help"
            className="w-full rounded-lg border border-[#e8e2dc] bg-[#fcfbf9] p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#181512]/20"
          />
          <p id="muiro-category-slug-help" className="mb-4 mt-1 text-[11px] text-[#8c827a]">Lowercase letters, numbers, and hyphens only.</p>

          <label htmlFor="muiro-category-description" className="mb-1 block text-xs font-semibold uppercase text-[#6e6761]">Description <span className="font-normal normal-case">(optional)</span></label>
          <textarea
            id="muiro-category-description"
            maxLength={300}
            rows={3}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="A short note about what belongs in this edit."
            className="mb-2 w-full resize-y rounded-lg border border-[#e8e2dc] bg-[#fcfbf9] p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#181512]/20"
          />
          <p className="mb-5 text-right text-[11px] text-[#8c827a]">{description.length}/300 characters</p>

          <div className="flex flex-wrap justify-end gap-2">
            {editing && <button type="button" onClick={clearForm} className="min-h-10 rounded-lg border border-[#e8e2dc] px-4 text-xs font-bold uppercase tracking-wide text-[#6e6761] hover:bg-[#fcfbf9]">Cancel</button>}
            <button type="submit" disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#181512] px-4 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60">
              {editing ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              {saving ? 'Saving…' : editing ? 'Save category' : 'Add category'}
            </button>
          </div>
        </form>

        <div role="list" aria-label="Saved product categories" className="space-y-3">
          {sortedCategories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d8d0c8] bg-white p-8 text-center">
              <Tag className="mx-auto mb-3 h-8 w-8 text-[#8c827a]" aria-hidden="true" />
              <h3 className="font-semibold text-[#181512]">No categories yet</h3>
              <p className="mt-1 text-sm text-[#6e6761]">Create your first category, then choose it while adding products or lookbooks.</p>
            </div>
          ) : sortedCategories.map(category => {
            const productCount = assignedCount(category.name, products);
            const lookbookCount = assignedCount(category.name, lookbooks);
            const isDeleting = deletingId === category.id;
            return (
              <article key={category.id} role="listitem" className="rounded-2xl border border-[#e8e2dc] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-[#181512]">{category.name}</h3>
                    <p className="mt-0.5 text-xs text-[#8c827a]">/{category.slug}</p>
                    {category.description && <p className="mt-2 text-sm leading-relaxed text-[#6e6761]">{category.description}</p>}
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#6e6761]">{productCount} {productCount === 1 ? 'product' : 'products'} · {lookbookCount} {lookbookCount === 1 ? 'lookbook' : 'lookbooks'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => beginEdit(category)} aria-label={`Edit ${category.name}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#e8e2dc] px-3 text-xs font-semibold text-[#181512] transition hover:bg-[#fcfbf9]"><Edit2 className="h-3.5 w-3.5" aria-hidden="true" />Edit</button>
                    <button type="button" onClick={() => void handleDelete(category)} disabled={productCount + lookbookCount > 0 || deletingId !== null} aria-label={`Delete ${category.name}`} title={productCount + lookbookCount > 0 ? 'Reassign content before deleting' : 'Delete category'} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{isDeleting ? 'Deleting…' : 'Delete'}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
