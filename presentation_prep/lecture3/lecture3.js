const slides = [...document.querySelectorAll('.slide')];
const counter = document.querySelector('#slide-counter');
const previousButton = document.querySelector('#previous');
const nextButton = document.querySelector('#next');
const presentButton = document.querySelector('#present');
const notesDialog = document.querySelector('#notes-dialog');
const notesContent = document.querySelector('#notes-content');
let index = 0;

function updateNotes() {
  notesContent.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = `${index + 1}. ${slides[index].getAttribute('aria-label')}`;
  notesContent.append(title);
  const notes = slides[index].querySelector('.notes');
  if (notes) {
    for (const child of notes.childNodes) notesContent.append(child.cloneNode(true));
  } else {
    const empty = document.createElement('p');
    empty.textContent = 'No speaker notes for this slide.';
    notesContent.append(empty);
  }
}

function show() {
  slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
  document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1280, innerHeight / 720));
  counter.textContent = `${index + 1} / ${slides.length}`;
  previousButton.disabled = index === 0;
  nextButton.disabled = index === slides.length - 1;
  presentButton.textContent = document.body.classList.contains('present') ? 'Overview' : 'Present';
  presentButton.setAttribute('aria-pressed', String(document.body.classList.contains('present')));
  if (!notesDialog.hidden) updateNotes();
}

function navigate(nextIndex) {
  index = Math.max(0, Math.min(nextIndex, slides.length - 1));
  history.replaceState(null, '', `#slide-${index + 1}`);
  show();
  if (!document.body.classList.contains('present')) slides[index].scrollIntoView({ block: 'start' });
}

function togglePresentation() {
  document.body.classList.toggle('present');
  show();
  if (!document.body.classList.contains('present')) slides[index].scrollIntoView({ block: 'start' });
}

function toggleNotes() {
  notesDialog.hidden = !notesDialog.hidden;
  if (!notesDialog.hidden) updateNotes();
}

function readHash() {
  const slideNumber = Number(location.hash.match(/^#slide-(\d+)$/)?.[1]);
  if (slideNumber >= 1 && slideNumber <= slides.length) {
    index = slideNumber - 1;
    show();
    if (!document.body.classList.contains('present')) slides[index].scrollIntoView({ block: 'start' });
  }
}

previousButton.addEventListener('click', () => navigate(index - 1));
nextButton.addEventListener('click', () => navigate(index + 1));
presentButton.addEventListener('click', togglePresentation);
document.querySelector('#notes').addEventListener('click', toggleNotes);
document.querySelector('#close-notes').addEventListener('click', toggleNotes);
addEventListener('resize', show);
addEventListener('hashchange', readHash);
addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable]')) return;
  if (event.key === 'Escape') {
    if (!notesDialog.hidden) notesDialog.hidden = true;
    else if (document.body.classList.contains('present')) togglePresentation();
    return;
  }
  if (event.target.closest('button, a') && [' ', 'Enter'].includes(event.key)) return;
  if (event.key.toLowerCase() === 'f') togglePresentation();
  else if (event.key.toLowerCase() === 'n') toggleNotes();
  else if (['ArrowRight', 'PageDown', ' ', 'ArrowLeft', 'PageUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    document.body.classList.add('present');
    if (event.key === 'Home') navigate(0);
    else if (event.key === 'End') navigate(slides.length - 1);
    else navigate(index + (['ArrowRight', 'PageDown', ' '].includes(event.key) ? 1 : -1));
  }
});

const logoPath = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcKICAgd2lkdGg9IjQyMiIKICAgaGVpZ2h0PSI0MjIuMDAwMDMiCiAgIHZpZXdCb3g9IjAgMCA0MjIgNDIyLjAwMDAzIgogICBmaWxsPSJub25lIgogICB2ZXJzaW9uPSIxLjEiCiAgIGlkPSJzdmc0IgogICB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiAgIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxwYXRoCiAgICAgZD0iTSAyMTAuOTk5OTQsOC40MTI5MDc4ZS02IEEgMjExLDIxMSAwIDAgMCAtNi4wOTM3NWUtNSwyMTEuMDAwMDEgYSAyMTEsMjExIDAgMCAwIDIxMS4wMDAwMDA5Mzc1LDIxMSAyMTEsMjExIDAgMCAwIDIxMSwtMjExIDIxMSwyMTEgMCAwIDAgLTEzLjI3NTQsLTczLjY2MjExIGwgLTEwNi4zMjgxLDYxLjM5MDYzIGEgODcuNSw4Ny41IDAgMCAxIDAuNTg1OSwxMC4xMDkzNyA4Ny41LDg3LjUgMCAwIDEgLTg3LjUsODcuNSA4Ny41LDg3LjUgMCAwIDEgLTg3LjUsLTg3LjUgODcuNSw4Ny41IDAgMCAxIDg3LjUsLTg3LjUgODcuNSw4Ny41IDAgMCAxIDUwLjQ2MjksMTYuMDE3NTggTCAzNzIuODUzNDQsNzUuNjMyODE5IEEgMjExLDIxMSAwIDAgMCAyMTAuOTk5OTQsOC40MTI5MDc4ZS02IFoiCiAgICAgc3R5bGU9ImZpbGw6I2YyNGIzNyIKICAgICBpZD0icGF0aDYiIC8+CiAgPGRlZnMKICAgICBpZD0iZGVmczQiIC8+Cjwvc3ZnPgo=';
slides.forEach((slide, slideIndex) => {
  const footer = document.createElement('header');
  footer.innerHTML = `<img class="official-logo" src="${logoPath}" alt="Cauchy"><span class="folio">${slideIndex + 1}</span>`;
  slide.append(footer);
});

const observer = new IntersectionObserver(entries => {
  if (document.body.classList.contains('present')) return;
  const visible = entries.filter(entry => entry.isIntersecting).sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
  if (visible) {
    index = slides.indexOf(visible.target);
    show();
  }
}, { threshold: .55 });
slides.forEach(slide => observer.observe(slide));
show();
readHash();
