export function DestinationDirectorySection() {
  return (
    <section
      className="container destination-directory"
      id="destination-directory"
      aria-labelledby="directoryTitle"
    >
      <div className="caption section-kicker">
        <svg className="section-mark" viewBox="0 0 24 24" aria-hidden="true">
          <use href="#i-compass" width="24" height="24" />
        </svg>
        <span>دليل المنطقة</span>
      </div>
      <h3 id="directoryTitle">دليل محافظات ووجهات منطقة الباحة</h3>
      <p>
        تضم منطقة الباحة العاصمة الإدارية و9 محافظات ترتبط بها 11 بلدية مع معالمها المعتمدة
      </p>
      <div className="destination-grid" id="destinationGrid" />
    </section>
  );
}
