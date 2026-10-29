"use strict";

/* THE GAME 2026 - PRIVATE ARCHIVE */

const STORAGE_KEY = "theGame2026Archive_v1";

const DEFAULT_CATEGORIES = [
  { id: "people", name: "People", icon: "♙", description: "Profiles, roles and contributions." },
  { id: "builds", name: "Builds & locations", icon: "⌂", description: "Island areas, builds and coordinates." },
  { id: "lore", name: "Lore & story", icon: "◈", description: "Characters, history and world lore." },
  { id: "events", name: "Quests & events", icon: "◇", description: "Quest details, schedules and event history." },
  { id: "technical", name: "Technical notes", icon: "⌘", description: "Commands, IDs, code and fixes." },
  { id: "archive", name: "Archive & misc.", icon: "▧", description: "Ideas, decisions and miscellaneous records." }
];

const PAGE_NAMES = {
  home: "Overview",
  all: "All entries",
  people: "People",
  builds: "Builds & locations",
  lore: "Lore & story",
  events: "Quests & events",
  technical: "Technical notes",
  archive: "Archive & misc.",
  favorites: "Favorites"
};

const CATEGORY_ALIASES = {
  person: "people",
  character: "lore",
  quest: "events",
  event: "events",
  build: "builds",
  location: "builds",
  tech: "technical",
  miscellaneous: "archive",
  misc: "archive"
};

let categories = DEFAULT_CATEGORIES.map(category => ({ ...category }));
let entries = [];

let page = "home";
let editingId = null;
let viewingId = null;
let returnPage = "all";
let searchQuery = "";
let listFilter = "all";
let sortOrder = "updated";
let toastTimeout = null;

const content = document.getElementById("content");
const searchInput = document.getElementById("searchInput");
const breadcrumbCurrent = document.getElementById("breadcrumbCurrent");
const customNav = document.getElementById("customNav");
const mainNav = document.getElementById("mainNav");
const toastElement = document.getElementById("toast");
const importFile = document.getElementById("importFile");

/* -------------------- UTILITIES -------------------- */

function uid() {
  return "entry_" + Date.now().toString(36) + "_" +
    Math.random().toString(36).slice(2, 9);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function normalizeCategoryId(value) {
  const id = String(value || "archive").trim().toLowerCase();
  return CATEGORY_ALIASES[id] || id;
}

function categoryById(id) {
  return categories.find(category => category.id === id);
}

function categoryName(id) {
  return categoryById(id)?.name || "Archive & misc.";
}

function categoryIcon(id) {
  return categoryById(id)?.icon || "▧";
}

function formatDate(value) {
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function plainText(value) {
  return String(value || "").trim();
}

function splitTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(tag => String(tag).trim()).filter(Boolean))];
  }

  return [...new Set(
    String(value || "")
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean)
  )];
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("visible");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastElement.classList.remove("visible");
  }, 2800);
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      categories,
      entries
    }));
    return true;
  } catch (error) {
    console.error("Could not save archive:", error);
    showToast("Could not save. Browser storage may be full.");
    return false;
  }
}

function normalizeEntry(raw, index = 0) {
  const entry = raw && typeof raw === "object" ? raw : {};
  const requestedCategory = normalizeCategoryId(entry.category);
  const category = categoryById(requestedCategory)
    ? requestedCategory
    : "archive";

  const now = new Date().toISOString();

  return {
    id: String(entry.id || uid() + "_" + index),
    title: plainText(entry.title) || "Untitled entry",
    category,
    status: plainText(entry.status) || "Reference",
    summary: String(entry.summary || ""),
    content: String(entry.content || ""),
    tags: splitTags(entry.tags),
    related: Array.isArray(entry.related)
      ? [...new Set(entry.related.map(String))]
      : [],
    favorite: Boolean(entry.favorite),
    personRole: String(entry.personRole || ""),
    personContributions: String(entry.personContributions || ""),
    personBuilds: String(entry.personBuilds || ""),
    personHistory: String(entry.personHistory || ""),
    personInvolvement: String(entry.personInvolvement || ""),
    createdAt: entry.createdAt || now,
    updatedAt: entry.updatedAt || entry.createdAt || now
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      entries = [];
      categories = DEFAULT_CATEGORIES.map(category => ({ ...category }));
      return;
    }

    const parsed = JSON.parse(raw);

    // Supports the original format (an array of entries)
    // and the newer format ({ categories, entries }).
    const storedCategories = Array.isArray(parsed)
      ? []
      : Array.isArray(parsed?.categories)
        ? parsed.categories
        : [];

    const mergedCategories = DEFAULT_CATEGORIES.map(category => {
      const stored = storedCategories.find(item => item?.id === category.id);
      return stored
        ? { ...category, name: category.name, icon: category.icon }
        : { ...category };
    });

    for (const stored of storedCategories) {
      if (!stored || typeof stored !== "object") continue;

      const id = String(stored.id || "").trim().toLowerCase();
      const name = plainText(stored.name);

      if (
        !id ||
        !name ||
        mergedCategories.some(category => category.id === id)
      ) {
        continue;
      }

      if (!/^[a-z0-9_-]{2,40}$/.test(id)) continue;

      mergedCategories.push({
        id,
        name,
        icon: String(stored.icon || "▧").slice(0, 4),
        description: String(stored.description || "Custom archive category.")
      });
    }

    // Categories must load BEFORE entries are normalized.
    categories = mergedCategories;

    const storedEntries = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.entries)
        ? parsed.entries
        : [];

    entries = storedEntries.map(normalizeEntry);
  } catch (error) {
    console.error("Could not load archive:", error);
    entries = [];
    categories = DEFAULT_CATEGORIES.map(category => ({ ...category }));
    showToast("Archive data could not be read. Check your backup.");
  }
}

/* -------------------- NAVIGATION -------------------- */

function currentPageName() {
  if (page === "detail") {
    return entries.find(entry => entry.id === viewingId)?.title || "Entry";
  }

  if (page === "editor") {
    return editingId ? "Edit entry" : "New entry";
  }

  if (page === "category-manager") {
    return "Manage categories";
  }

  return PAGE_NAMES[page] || categoryName(page);
}

function updateNavigation() {
  breadcrumbCurrent.textContent = currentPageName();

  mainNav.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  customNav.querySelectorAll("[data-category]").forEach(button => {
    button.classList.toggle("active", button.dataset.category === page);
  });
}

function setPage(nextPage) {
  page = nextPage;
  editingId = null;
  viewingId = null;
  listFilter = "all";
  render();
}

function openEditor(id = null) {
  returnPage = page === "detail"
    ? entries.find(entry => entry.id === viewingId)?.category || "all"
    : page;

  editingId = id;
  viewingId = null;
  page = "editor";
  render();
}

function openEntry(id) {
  if (!entries.some(entry => entry.id === id)) return;

  viewingId = id;
  editingId = null;
  page = "detail";
  render();
}

function renderCustomNavigation() {
  customNav.innerHTML = categories
    .filter(category => !DEFAULT_CATEGORIES.some(item => item.id === category.id))
    .map(category => `
      <button class="nav-item" data-category="${escapeHTML(category.id)}">
        <span>${escapeHTML(category.icon)}</span>
        ${escapeHTML(category.name)}
      </button>
    `)
    .join("");
}

/* -------------------- SEARCH AND FILTERING -------------------- */

function entrySearchText(entry) {
  const relatedNames = entry.related
    .map(id => entries.find(item => item.id === id)?.title || "")
    .join(" ");

  return [
    entry.title,
    entry.category,
    categoryName(entry.category),
    entry.status,
    entry.summary,
    entry.content,
    entry.tags.join(" "),
    entry.personRole,
    entry.personContributions,
    entry.personBuilds,
    entry.personHistory,
    entry.personInvolvement,
    relatedNames
  ].join(" ").toLowerCase();
}

function getVisibleEntries() {
  let result = [...entries];

  if (page === "favorites") {
    result = result.filter(entry => entry.favorite);
  } else if (page === "people") {
    result = result.filter(entry => entry.category === "people");
  } else if (page === "builds") {
    result = result.filter(entry => entry.category === "builds");
  } else if (page === "lore") {
    result = result.filter(entry => entry.category === "lore");
  } else if (page === "events") {
    result = result.filter(entry => entry.category === "events");
  } else if (page === "technical") {
    result = result.filter(entry => entry.category === "technical");
  } else if (page === "archive") {
    result = result.filter(entry => entry.category === "archive");
  } else if (categoryById(page)) {
    result = result.filter(entry => entry.category === page);
  }

  if (listFilter !== "all") {
    result = result.filter(entry => entry.status === listFilter);
  }

  if (searchQuery) {
    result = result.filter(entry =>
      entrySearchText(entry).includes(searchQuery.toLowerCase())
    );
  }

  result.sort((a, b) => {
    if (sortOrder === "title") {
      return a.title.localeCompare(b.title);
    }

    if (sortOrder === "created") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }

    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return result;
}

/* -------------------- SHARED UI -------------------- */

function pageHeading(title, subtitle, actions = "") {
  return `
    <div class="page-heading">
      <div>
        <div class="eyebrow">THE GAME 2026 / ARCHIVE</div>
        <h1>${escapeHTML(title)}</h1>
        <p class="subtitle">${escapeHTML(subtitle)}</p>
      </div>
      ${actions ? `<div class="heading-actions">${actions}</div>` : ""}
    </div>
  `;
}

function entryRow(entry) {
  const statusClass = entry.status === "Complete"
    ? "green"
    : entry.status === "In progress"
      ? "orange"
      : "neutral";

  const tagMarkup = entry.tags.slice(0, 4).map(tag =>
    `<span class="pill neutral">${escapeHTML(tag)}</span>`
  ).join("");

  return `
    <article class="entry-row">
      <div class="entry-main" data-open-entry="${escapeHTML(entry.id)}">
        <div class="entry-title">${escapeHTML(entry.title)}</div>
        ${entry.summary
          ? `<div class="entry-summary">${escapeHTML(entry.summary)}</div>`
          : ""}
        <div class="entry-meta">
          <span class="pill">${escapeHTML(categoryName(entry.category))}</span>
          <span class="pill ${statusClass}">${escapeHTML(entry.status)}</span>
          ${tagMarkup}
          <span>Updated ${escapeHTML(formatDate(entry.updatedAt))}</span>
        </div>
      </div>
      <div class="row-actions">
        <button class="icon-button ${entry.favorite ? "is-favorite" : ""}"
          data-favorite="${escapeHTML(entry.id)}"
          title="${entry.favorite ? "Remove favorite" : "Add favorite"}"
          aria-label="${entry.favorite ? "Remove favorite" : "Add favorite"}">
          ${entry.favorite ? "★" : "☆"}
        </button>
        <button class="icon-button" data-edit-entry="${escapeHTML(entry.id)}"
          title="Edit entry" aria-label="Edit entry">✎</button>
      </div>
    </article>
  `;
}

function renderEntryList(items, emptyTitle, emptyDescription) {
  if (!items.length) {
    return `
      <div class="empty-state">
        <strong>${escapeHTML(emptyTitle)}</strong>
        <p>${escapeHTML(emptyDescription)}</p>
        <button class="primary-button" data-action="new-entry">+ Create entry</button>
      </div>
    `;
  }

  return `<div class="entry-list">${items.map(entryRow).join("")}</div>`;
}

function categoryCard(category) {
  const count = entries.filter(entry => entry.category === category.id).length;

  return `
    <button class="category-card" data-category="${escapeHTML(category.id)}">
      <span class="category-symbol">${escapeHTML(category.icon)}</span>
      <strong>${escapeHTML(category.name)}</strong>
      <small>${count} ${count === 1 ? "entry" : "entries"}</small>
    </button>
  `;
}

/* -------------------- OVERVIEW -------------------- */

function renderHome() {
  const recent = [...entries]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);

  const favoriteCount = entries.filter(entry => entry.favorite).length;
  const peopleCount = entries.filter(entry => entry.category === "people").length;
  const buildCount = entries.filter(entry => entry.category === "builds").length;

  content.innerHTML = `
    ${pageHeading(
      "Project archive",
      "A central place for The Game 2026's history, people, builds, lore and technical knowledge.",
      `<button class="primary-button" data-action="new-entry">+ New entry</button>`
    )}

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">TOTAL ENTRIES</div>
        <div class="stat-number">${entries.length}</div>
        <div class="stat-foot">Everything recorded</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">PEOPLE</div>
        <div class="stat-number">${peopleCount}</div>
        <div class="stat-foot">Profiles and contributions</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">BUILDS</div>
        <div class="stat-number">${buildCount}</div>
        <div class="stat-foot">Locations and creations</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">FAVORITES</div>
        <div class="stat-number">${favoriteCount}</div>
        <div class="stat-foot">Important reference entries</div>
      </div>
    </div>

    <div class="section-header">
      <h2>Knowledge sections</h2>
      <button class="text-button" data-action="manage-categories">Manage categories</button>
    </div>
    <div class="category-grid">
      ${categories.map(categoryCard).join("")}
    </div>

    <div class="section-header">
      <h2>Recently updated</h2>
      <button class="text-button" data-page="all">View all entries →</button>
    </div>
    ${renderEntryList(
      recent,
      "Your archive is empty",
      "Create an entry to start recording project information, ideas, people or builds."
    )}
  `;
}

/* -------------------- LIST PAGES -------------------- */

function renderListPage() {
  const title = currentPageName();
  const description = page === "favorites"
    ? "Entries you have marked as important."
    : page === "all"
      ? "Search, browse and manage all saved project knowledge."
      : `Browse and maintain your ${title.toLowerCase()} records.`;

  const items = getVisibleEntries();
  const statuses = ["all", ...new Set(entries.map(entry => entry.status).filter(Boolean))];

  content.innerHTML = `
    ${pageHeading(
      title,
      description,
      `<button class="primary-button" data-action="new-entry">+ New entry</button>`
    )}

    <div class="filter-bar">
      <select id="statusFilter" aria-label="Filter by status">
        ${statuses.map(status => `
          <option value="${escapeHTML(status)}" ${listFilter === status ? "selected" : ""}>
            ${status === "all" ? "All statuses" : escapeHTML(status)}
          </option>
        `).join("")}
      </select>

      <select id="sortFilter" aria-label="Sort entries">
        <option value="updated" ${sortOrder === "updated" ? "selected" : ""}>Recently updated</option>
        <option value="created" ${sortOrder === "created" ? "selected" : ""}>Recently created</option>
        <option value="title" ${sortOrder === "title" ? "selected" : ""}>Alphabetical</option>
      </select>

      <span class="subtitle">${items.length} ${items.length === 1 ? "entry" : "entries"}</span>
    </div>

    ${renderEntryList(
      items,
      searchQuery ? "No matching entries" : "Nothing here yet",
      searchQuery
        ? "Try a different search term or clear the search field."
        : "Add an entry to build up this part of your archive."
    )}
  `;
}

/* -------------------- ENTRY EDITOR -------------------- */

function renderEditor() {
  const entry = editingId
    ? entries.find(item => item.id === editingId)
    : null;

  const isEditing = Boolean(entry);
  const selectedCategory = entry?.category ||
    (categoryById(returnPage) ? returnPage : "archive");

  const relatedOptions = entries
    .filter(item => item.id !== entry?.id)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map(item => `
      <option value="${escapeHTML(item.id)}"
        ${entry?.related.includes(item.id) ? "selected" : ""}>
        ${escapeHTML(item.title)} (${escapeHTML(categoryName(item.category))})
      </option>
    `).join("");

  content.innerHTML = `
    ${pageHeading(
      isEditing ? "Edit entry" : "Create entry",
      "Record information in a way that will still make sense when you look it up later."
    )}

    <form id="entryForm" class="form-layout">
      <div class="form-panel">
        <section class="form-section">
          <h2>Basic information</h2>
          <div class="form-field">
            <label for="entryTitle">Title *</label>
            <input class="field" id="entryTitle" name="title" required maxlength="180"
              placeholder="e.g. Hallowed King, Frozen Crimson Forest, Quest 9"
              value="${escapeHTML(entry?.title || "")}">
          </div>

          <div class="form-grid">
            <div class="form-field">
              <label for="entryCategory">Category *</label>
              <select class="field" id="entryCategory" name="category" required>
                ${categories.map(category => `
                  <option value="${escapeHTML(category.id)}"
                    ${selectedCategory === category.id ? "selected" : ""}>
                    ${escapeHTML(category.name)}
                  </option>
                `).join("")}
              </select>
            </div>

            <div class="form-field">
              <label for="entryStatus">Status</label>
              <select class="field" id="entryStatus" name="status">
                ${["Reference", "In progress", "Complete", "Archived", "On hold"]
                  .map(status => `
                    <option value="${status}"
                      ${(entry?.status || "Reference") === status ? "selected" : ""}>
                      ${status}
                    </option>
                  `).join("")}
              </select>
            </div>
          </div>

          <div class="form-field">
            <label for="entrySummary">Short summary</label>
            <textarea class="field" id="entrySummary" name="summary" rows="3"
              maxlength="2000"
              placeholder="A short explanation so you can identify this entry quickly.">${escapeHTML(entry?.summary || "")}</textarea>
          </div>

          <div class="form-field">
            <label for="entryContent">Full information</label>
            <textarea class="field" id="entryContent" name="content" rows="12"
              placeholder="Record the details, context, decisions, coordinates, commands, references or history here.">${escapeHTML(entry?.content || "")}</textarea>
            <small>Plain text is supported. Line breaks are preserved.</small>
          </div>
        </section>

        <section class="form-section">
          <h2>People profile details</h2>
          <p class="subtitle">These fields are especially useful for entries in the People category. They can also be used for characters or other records.</p>

          <div class="form-grid">
            <div class="form-field">
              <label for="personRole">Role</label>
              <input class="field" id="personRole" name="personRole" maxlength="300"
                placeholder="Builder, co-lead, founder..."
                value="${escapeHTML(entry?.personRole || "")}">
            </div>

            <div class="form-field">
              <label for="personInvolvement">Current involvement</label>
              <input class="field" id="personInvolvement" name="personInvolvement" maxlength="500"
                placeholder="Active, former member, occasional..."
                value="${escapeHTML(entry?.personInvolvement || "")}">
            </div>

            <div class="form-field full-span">
              <label for="personContributions">Contributions and work</label>
              <textarea class="field" id="personContributions" name="personContributions" rows="3"
                placeholder="What did this person contribute to the project?">${escapeHTML(entry?.personContributions || "")}</textarea>
            </div>

            <div class="form-field full-span">
              <label for="personBuilds">Associated builds or areas</label>
              <textarea class="field" id="personBuilds" name="personBuilds" rows="2"
                placeholder="Builds, locations or features they worked on.">${escapeHTML(entry?.personBuilds || "")}</textarea>
            </div>

            <div class="form-field full-span">
              <label for="personHistory">History and relevant notes</label>
              <textarea class="field" id="personHistory" name="personHistory" rows="3"
                placeholder="Relevant project history, role changes or context.">${escapeHTML(entry?.personHistory || "")}</textarea>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h2>Organization</h2>

          <div class="form-field">
            <label for="entryTags">Tags</label>
            <input class="field" id="entryTags" name="tags" maxlength="1000"
              placeholder="halloween, hallowed-realm, coordinates"
              value="${escapeHTML((entry?.tags || []).join(", "))}">
            <small>Separate tags with commas.</small>
          </div>

          <div class="form-field">
            <label for="entryRelated">Related entries</label>
            <select class="field" id="entryRelated" name="related" multiple size="5">
              ${relatedOptions}
            </select>
            <small>Hold Ctrl (Windows) or Command (Mac) to select multiple entries.</small>
          </div>

          <label class="check-row">
            <input type="checkbox" name="favorite" ${entry?.favorite ? "checked" : ""}>
            Mark as a favorite
          </label>
        </section>

        <div class="form-actions">
          <button class="primary-button" type="submit">
            ${isEditing ? "Save changes" : "Create entry"}
          </button>
          <button class="button" type="button" data-action="cancel-editor">Cancel</button>
          ${isEditing
            ? `<button class="button danger" type="button" data-delete-entry="${escapeHTML(entry.id)}">Delete entry</button>`
            : ""}
        </div>
      </div>

      <aside class="side-panel">
        <h3>Keeping the archive useful</h3>
        <div class="side-data">
          <div>
            <span>Use descriptive titles</span>
            <strong>Make entries searchable without remembering the exact wording.</strong>
          </div>
          <div>
            <span>Record context</span>
            <strong>Include why something matters, not just what it is.</strong>
          </div>
          <div>
            <span>Connect related records</span>
            <strong>Link people to builds, quests to lore, and technical notes to locations.</strong>
          </div>
          <div>
            <span>Back up regularly</span>
            <strong>Export a JSON backup before clearing browser data or changing devices.</strong>
          </div>
        </div>
      </aside>
    </form>
  `;
}

/* -------------------- ENTRY DETAILS -------------------- */

function renderDetail() {
  const entry = entries.find(item => item.id === viewingId);

  if (!entry) {
    setPage("all");
    return;
  }

  const relatedEntries = entry.related
    .map(id => entries.find(item => item.id === id))
    .filter(Boolean);

  const tags = entry.tags.length
    ? entry.tags.map(tag => `<span class="pill neutral">${escapeHTML(tag)}</span>`).join("")
    : `<span class="subtitle">No tags added.</span>`;

  const profileFields = entry.category === "people" || [
    entry.personRole,
    entry.personContributions,
    entry.personBuilds,
    entry.personHistory,
    entry.personInvolvement
  ].some(Boolean);

  content.innerHTML = `
    ${pageHeading(
      categoryName(entry.category),
      "Archive entry",
      `
        <button class="button" data-action="back-detail">← Back</button>
        <button class="button" data-edit-entry="${escapeHTML(entry.id)}">Edit entry</button>
      `
    )}

    <div class="form-layout">
      <article class="detail-panel">
        <div class="detail-top">
          <div class="detail-title">
            <span class="pill">${escapeHTML(categoryName(entry.category))}</span>
            <h1>${escapeHTML(entry.title)}</h1>
            <div class="entry-meta">
              <span class="pill neutral">${escapeHTML(entry.status)}</span>
              <span>Created ${escapeHTML(formatDate(entry.createdAt))}</span>
              <span>Updated ${escapeHTML(formatDate(entry.updatedAt))}</span>
            </div>
          </div>
          <button class="icon-button ${entry.favorite ? "is-favorite" : ""}"
            data-favorite="${escapeHTML(entry.id)}"
            title="${entry.favorite ? "Remove favorite" : "Add favorite"}"
            aria-label="${entry.favorite ? "Remove favorite" : "Add favorite"}">
            ${entry.favorite ? "★" : "☆"}
          </button>
        </div>

        ${entry.summary
          ? `<div class="detail-block"><p class="detail-summary">${escapeHTML(entry.summary)}</p></div>`
          : ""}

        <div class="detail-content">${escapeHTML(entry.content)
          .split("\n\n")
          .map(paragraph => paragraph.trim()
            ? `<p>${paragraph.replace(/\n/g, "<br>")}</p>`
            : "")
          .join("") || `<p class="subtitle">No additional information has been recorded yet.</p>`}
        </div>

        ${profileFields ? `
          <div class="detail-block">
            <h2>Profile information</h2>
            ${entry.personRole ? `<div class="detail-block"><h3>Role</h3><p>${escapeHTML(entry.personRole)}</p></div>` : ""}
            ${entry.personInvolvement ? `<div class="detail-block"><h3>Current involvement</h3><p>${escapeHTML(entry.personInvolvement)}</p></div>` : ""}
            ${entry.personContributions ? `<div class="detail-block"><h3>Contributions</h3><p>${escapeHTML(entry.personContributions)}</p></div>` : ""}
            ${entry.personBuilds ? `<div class="detail-block"><h3>Associated builds and areas</h3><p>${escapeHTML(entry.personBuilds)}</p></div>` : ""}
            ${entry.personHistory ? `<div class="detail-block"><h3>History and notes</h3><p>${escapeHTML(entry.personHistory)}</p></div>` : ""}
          </div>
        ` : ""}

        <div class="detail-block">
          <h2>Tags</h2>
          <div class="detail-tags">${tags}</div>
        </div>

        <div class="detail-block">
          <h2>Related entries</h2>
          ${relatedEntries.length
            ? `<div class="related-list">${relatedEntries.map(related => `
                <button class="related-link" data-open-entry="${escapeHTML(related.id)}">
                  ${escapeHTML(related.title)} →
                </button>
              `).join("")}</div>`
            : `<p class="subtitle">No related entries linked yet.</p>`}
        </div>
      </article>

      <aside class="detail-side">
        <div class="side-panel">
          <h3>Entry details</h3>
          <div class="side-data">
            <div><span>Category</span><strong>${escapeHTML(categoryName(entry.category))}</strong></div>
            <div><span>Status</span><strong>${escapeHTML(entry.status)}</strong></div>
            <div><span>Created</span><strong>${escapeHTML(formatDate(entry.createdAt))}</strong></div>
            <div><span>Last updated</span><strong>${escapeHTML(formatDate(entry.updatedAt))}</strong></div>
            <div><span>Favorite</span><strong>${entry.favorite ? "Yes" : "No"}</strong></div>
          </div>
        </div>
      </aside>
    </div>
  `;
}

/* -------------------- CATEGORY MANAGEMENT -------------------- */

function renderCategoryManager() {
  content.innerHTML = `
    ${pageHeading(
      "Manage categories",
      "Create additional sections for the way you organize your archive."
    )}

    <div class="form-layout">
      <section class="form-panel">
        <h2>New category</h2>
        <form id="categoryForm">
          <div class="form-grid">
            <div class="form-field">
              <label for="categoryNameInput">Category name *</label>
              <input class="field" id="categoryNameInput" name="name" required maxlength="50"
                placeholder="e.g. Website development">
            </div>
            <div class="form-field">
              <label for="categoryIconInput">Icon or symbol</label>
              <input class="field" id="categoryIconInput" name="icon" maxlength="4"
                placeholder="◇" value="◇">
            </div>
          </div>
          <div class="form-field">
            <label for="categoryDescriptionInput">Description</label>
            <input class="field" id="categoryDescriptionInput" name="description" maxlength="160"
              placeholder="What belongs in this section?">
          </div>
          <button class="primary-button" type="submit">+ Create category</button>
        </form>
      </section>

      <section class="form-panel">
        <h2>Existing categories</h2>
        <div class="category-manager">
          ${categories.map(category => {
            const count = entries.filter(entry => entry.category === category.id).length;
            const isDefault = DEFAULT_CATEGORIES.some(item => item.id === category.id);

            return `
              <div class="category-manager-row">
                <div>
                  <strong>${escapeHTML(category.icon)} ${escapeHTML(category.name)}</strong>
                  <small>${count} ${count === 1 ? "entry" : "entries"}${isDefault ? " · Built-in category" : ""}</small>
                </div>
                ${isDefault
                  ? `<span class="pill neutral">Default</span>`
                  : `<button class="button danger" data-delete-category="${escapeHTML(category.id)}">Delete</button>`}
              </div>
            `;
          }).join("")}
        </div>
      </section>
    </div>
  `;
}

/* -------------------- RENDER ROUTER -------------------- */

function render() {
  renderCustomNavigation();
  updateNavigation();

  if (page === "home") {
    renderHome();
  } else if (page === "editor") {
    renderEditor();
  } else if (page === "detail") {
    renderDetail();
  } else if (page === "category-manager") {
    renderCategoryManager();
  } else {
    renderListPage();
  }
}

/* -------------------- SAVE AND DELETE ENTRIES -------------------- */

function handleEntrySubmit(form) {
  const formData = new FormData(form);
  const title = plainText(formData.get("title"));

  if (!title) {
    showToast("An entry needs a title.");
    return;
  }

  const category = normalizeCategoryId(formData.get("category"));

  if (!categoryById(category)) {
    showToast("Select a valid category.");
    return;
  }

  const existing = editingId
    ? entries.find(entry => entry.id === editingId)
    : null;

  const now = new Date().toISOString();
  const relatedSelect = form.querySelector("#entryRelated");

  const related = relatedSelect
    ? [...relatedSelect.selectedOptions].map(option => option.value)
    : [];

  const updatedEntry = {
    id: existing?.id || uid(),
    title,
    category,
    status: plainText(formData.get("status")) || "Reference",
    summary: String(formData.get("summary") || "").trim(),
    content: String(formData.get("content") || ""),
    tags: splitTags(formData.get("tags")),
    related: related.filter(id => id !== (existing?.id || "")),
    favorite: formData.get("favorite") === "on",
    personRole: String(formData.get("personRole") || "").trim(),
    personContributions: String(formData.get("personContributions") || "").trim(),
    personBuilds: String(formData.get("personBuilds") || "").trim(),
    personHistory: String(formData.get("personHistory") || "").trim(),
    personInvolvement: String(formData.get("personInvolvement") || "").trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  if (existing) {
    entries = entries.map(entry =>
      entry.id === existing.id ? updatedEntry : entry
    );
  } else {
    entries.push(updatedEntry);
  }

  saveData();
  viewingId = updatedEntry.id;
  editingId = null;
  page = "detail";
  render();

  showToast(existing ? "Entry updated." : "Entry created.");
}

function deleteEntry(id) {
  const entry = entries.find(item => item.id === id);
  if (!entry) return;

  if (!confirm(`Delete "${entry.title}"? This cannot be undone unless you have a backup.`)) {
    return;
  }

  entries = entries
    .filter(item => item.id !== id)
    .map(item => ({
      ...item,
      related: item.related.filter(relatedId => relatedId !== id)
    }));

  saveData();
  page = "all";
  editingId = null;
  viewingId = null;
  render();
  showToast("Entry deleted.");
}

function toggleFavorite(id) {
  const entry = entries.find(item => item.id === id);
  if (!entry) return;

  entry.favorite = !entry.favorite;
  entry.updatedAt = new Date().toISOString();
  saveData();
  render();

  showToast(entry.favorite ? "Added to favorites." : "Removed from favorites.");
}

/* -------------------- CATEGORY ACTIONS -------------------- */

function handleCategorySubmit(form) {
  const data = new FormData(form);
  const name = plainText(data.get("name"));
  const icon = plainText(data.get("icon")) || "▧";
  const description = plainText(data.get("description"));

  if (!name) {
    showToast("Enter a category name.");
    return;
  }

  const id = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  if (!id || id.length < 2) {
    showToast("Choose a longer category name.");
    return;
  }

  if (categories.some(category => category.id === id)) {
    showToast("A category with that name already exists.");
    return;
  }

  categories.push({
    id,
    name,
    icon: icon.slice(0, 4),
    description
  });

  saveData();
  render();
  showToast("Category created.");
}

function deleteCategory(id) {
  if (DEFAULT_CATEGORIES.some(category => category.id === id)) {
    showToast("Built-in categories cannot be deleted.");
    return;
  }

  const category = categoryById(id);
  if (!category) return;

  const count = entries.filter(entry => entry.category === id).length;

  if (count > 0) {
    showToast("Move or delete this category's entries before deleting it.");
    return;
  }

  if (!confirm(`Delete the "${category.name}" category?`)) return;

  categories = categories.filter(item => item.id !== id);

  if (page === id) page = "all";

  saveData();
  render();
  showToast("Category deleted.");
}

/* -------------------- IMPORT AND EXPORT -------------------- */

function exportBackup() {
  const backup = {
    application: "The Game 2026 Archive",
    version: 2,
    exportedAt: new Date().toISOString(),
    categories,
    entries
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `the-game-2026-archive-${new Date().toISOString().slice(0, 10)}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
  showToast("Backup exported.");
}

function importBackup(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));

      const importedEntries = Array.isArray(parsed)
        ? parsed
        : parsed && Array.isArray(parsed.entries)
          ? parsed.entries
          : null;

      if (!importedEntries) {
        throw new Error("The file does not contain a valid entries array.");
      }

      if (!confirm(
        "Import this backup and replace the current archive? Export your current archive first if you want to keep it."
      )) {
        importFile.value = "";
        return;
      }

      if (!Array.isArray(parsed)) {
        const importedCategories = Array.isArray(parsed.categories)
          ? parsed.categories
          : [];

        const nextCategories = DEFAULT_CATEGORIES.map(category => ({ ...category }));

        for (const item of importedCategories) {
          if (!item || typeof item !== "object") continue;

          const id = String(item.id || "").trim().toLowerCase();
          const name = plainText(item.name);

          if (
            !id ||
            !name ||
            !/^[a-z0-9_-]{2,40}$/.test(id) ||
            nextCategories.some(category => category.id === id)
          ) {
            continue;
          }

          nextCategories.push({
            id,
            name,
            icon: String(item.icon || "▧").slice(0, 4),
            description: String(item.description || "")
          });
        }

        categories = nextCategories;
      } else {
        categories = DEFAULT_CATEGORIES.map(category => ({ ...category }));
      }

      entries = importedEntries.map(normalizeEntry);

      // Remove broken references and duplicate IDs.
      const seen = new Set();

      entries = entries.filter(entry => {
        if (seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      });

      const validIds = new Set(entries.map(entry => entry.id));

      entries = entries.map(entry => ({
        ...entry,
        related: entry.related.filter(id => validIds.has(id) && id !== entry.id)
      }));

      saveData();
      page = "home";
      editingId = null;
      viewingId = null;
      render();
      showToast("Backup imported successfully.");
    } catch (error) {
      console.error("Import failed:", error);
      showToast("Import failed. Check that the file is a valid archive JSON backup.");
    } finally {
      importFile.value = "";
    }
  };

  reader.onerror = () => {
    showToast("Could not read that file.");
    importFile.value = "";
  };

  reader.readAsText(file);
}

/* -------------------- EVENT HANDLERS -------------------- */

document.getElementById("addEntryButton").addEventListener("click", () => {
  openEditor();
});

document.getElementById("manageCategoriesButton").addEventListener("click", () => {
  setPage("category-manager");
});

document.getElementById("exportButton").addEventListener("click", exportBackup);

document.getElementById("importButton").addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", () => {
  importBackup(importFile.files?.[0]);
});

mainNav.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (button) setPage(button.dataset.page);
});

customNav.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (button) setPage(button.dataset.category);
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim();

  if (page === "detail" || page === "editor" || page === "category-manager") {
    page = "all";
    editingId = null;
    viewingId = null;
  }

  render();
});

content.addEventListener("click", event => {
  const openButton = event.target.closest("[data-open-entry]");
  if (openButton) {
    openEntry(openButton.dataset.openEntry);
    return;
  }

  const editButton = event.target.closest("[data-edit-entry]");
  if (editButton) {
    openEditor(editButton.dataset.editEntry);
    return;
  }

  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.favorite);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-entry]");
  if (deleteButton) {
    deleteEntry(deleteButton.dataset.deleteEntry);
    return;
  }

  const deleteCategoryButton = event.target.closest("[data-delete-category]");
  if (deleteCategoryButton) {
    deleteCategory(deleteCategoryButton.dataset.deleteCategory);
    return;
  }

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    setPage(categoryButton.dataset.category);
    return;
  }

  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    setPage(pageButton.dataset.page);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  switch (actionButton.dataset.action) {
    case "new-entry":
      openEditor();
      break;

    case "manage-categories":
      setPage("category-manager");
      break;

    case "cancel-editor":
      setPage(returnPage || "all");
      break;

    case "back-detail": {
      const entry = entries.find(item => item.id === viewingId);
      setPage(entry?.category || "all");
      break;
    }
  }
});

content.addEventListener("submit", event => {
  if (event.target.id === "entryForm") {
    event.preventDefault();
    handleEntrySubmit(event.target);
  }

  if (event.target.id === "categoryForm") {
    event.preventDefault();
    handleCategorySubmit(event.target);
  }
});

content.addEventListener("change", event => {
  if (event.target.id === "statusFilter") {
    listFilter = event.target.value;
    render();
  }

  if (event.target.id === "sortFilter") {
    sortOrder = event.target.value;
    render();
  }
});

/* -------------------- START -------------------- */

loadData();
render();