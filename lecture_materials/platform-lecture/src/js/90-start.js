// ----- start: say so when the CDN did not answer, else open the deck -----
if (!window.gsap) {
  const fatal = $("#fatal");
  fatal.innerHTML = `<div><b>The deck could not load GSAP ${esc(BUILD.gsap || "")} from the CDN.</b><br>It needs the network when it opens. For a room without internet, open <code>index.bundled.html</code> (made by <code>src/build.py --bundle</code>).</div>`;
  fatal.hidden = false;
} else {
  Deck.start();
  window.__deck = Deck; // a hook for src/verify.py, not used by the deck itself
}
