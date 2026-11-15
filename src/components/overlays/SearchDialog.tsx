export function SearchDialog() {
  return (
    <dialog className="side-panel" id="searchPanel" aria-label="البحث عن الوجهات">
      <div className="panel-content">
        <div className="panel-top">
          <strong>ابحث في الباحة</strong>
          <button type="button" className="panel-close" data-close="" aria-label="إغلاق">
            <svg className="ic">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <input
          className="search-input"
          id="searchInput"
          type="search"
          placeholder="ابحث عن منتزه أو قرية تراثية أو محافظة"
          aria-label="البحث"
        />
        <div className="search-results" id="searchResults" aria-live="polite" />
      </div>
    </dialog>
  );
}
