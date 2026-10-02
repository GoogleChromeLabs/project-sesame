/*
 * @license
 * Copyright 2024 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License
 */

import '~project-sesame/client/layout';
import '~project-sesame/client/helpers/index';
import {Chip} from 'mdui/components/chip';

let selectedCategory = 'all';
let selectedApiName: string | null = null;

/**
 * Updates the selected states of category/API filter chips, API badges on
 * cards, and toggles visibility of demo cards matching both active filters.
 */
function applyFilters(): void {
  const categoryChips = document.querySelectorAll<Chip>(
    '#category-filter-bar mdui-chip[data-category]'
  );
  categoryChips.forEach(chip => {
    chip.selected = chip.dataset.category === selectedCategory;
  });

  const apiChips = document.querySelectorAll<Chip>(
    '#api-filter-bar mdui-chip[data-api]'
  );
  apiChips.forEach(chip => {
    const chipApi = chip.dataset.api;
    if (chipApi === 'all') {
      chip.selected = selectedApiName === null;
    } else {
      chip.selected = chipApi === selectedApiName;
    }
  });

  const cards = document.querySelectorAll<HTMLElement>('#demo-grid .demo-card');
  let visibleCount = 0;

  cards.forEach(card => {
    const categories = (card.dataset.categories || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    const apis = (card.dataset.apis || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    const matchesCategory =
      selectedCategory === 'all' || categories.includes(selectedCategory);
    const matchesApi = !selectedApiName || apis.includes(selectedApiName);
    const isVisible = matchesCategory && matchesApi;

    card.hidden = !isVisible;
    if (isVisible) {
      visibleCount++;
    }

    const badges = card.querySelectorAll<HTMLElement>('.api-badge[data-api]');
    badges.forEach(badge => {
      badge.dataset.active = String(badge.dataset.api === selectedApiName);
    });
  });

  const emptyMessage = document.getElementById('empty-message');
  if (emptyMessage) {
    emptyMessage.hidden = visibleCount > 0;
  }
}

/**
 * Initializes the demo catalog filters on the landing page.
 */
function initCatalogFilters(): void {
  const categoryBar = document.getElementById('category-filter-bar');
  const apiBar = document.getElementById('api-filter-bar');
  const demoGrid = document.getElementById('demo-grid');

  if (!categoryBar || !apiBar || !demoGrid) {
    return;
  }

  categoryBar.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof Element)) return;
    const chip = e.target.closest<Chip>('mdui-chip[data-category]');
    if (!chip || !chip.dataset.category) return;

    selectedCategory = chip.dataset.category;
    applyFilters();
  });

  apiBar.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof Element)) return;
    const chip = e.target.closest<Chip>('mdui-chip[data-api]');
    if (!chip || !chip.dataset.api) return;

    const chipApi = chip.dataset.api;
    if (chipApi === 'all') {
      selectedApiName = null;
    } else {
      selectedApiName = selectedApiName === chipApi ? null : chipApi;
    }
    applyFilters();
  });

  demoGrid.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof Element)) return;
    const badge = e.target.closest<HTMLElement>('.api-badge[data-api]');
    if (!badge || !badge.dataset.api) return;

    e.preventDefault();
    e.stopPropagation();
    const badgeApi = badge.dataset.api;
    selectedApiName = selectedApiName === badgeApi ? null : badgeApi;
    applyFilters();
  });

  applyFilters();
}

document.addEventListener('DOMContentLoaded', initCatalogFilters);
