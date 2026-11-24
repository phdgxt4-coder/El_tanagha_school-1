const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

export function card({eyebrow='',title,description='',icon='•',href='#'}) {
  return `<a class="card" href="${escapeHTML(href)}"><span class="card-icon" aria-hidden="true">${escapeHTML(icon)}</span><span class="eyebrow">${escapeHTML(eyebrow)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(description)}</p><span class="card-link">عرض المحتوى <b aria-hidden="true">←</b></span></a>`;
}

export function teacherCard({name,subject}) {
  return `<article class="card teacher-card"><span class="card-icon" aria-hidden="true">م</span><span class="eyebrow">${escapeHTML(subject)}</span><h3>${escapeHTML(name)}</h3><p>مدرس معتمد — ${escapeHTML(subject)}</p></article>`;
}

export function sectionHeading(kicker,title,copy='') {
  return `<header class="section-heading"><span class="eyebrow">${escapeHTML(kicker)}</span><h1>${escapeHTML(title)}</h1>${copy?`<p>${escapeHTML(copy)}</p>`:''}</header>`;
}

export function emptyState(message='لا يوجد محتوى منشور حاليًا') {
  return `<div class="empty-state"><span aria-hidden="true">✦</span><p>${escapeHTML(message)}</p></div>`;
}
