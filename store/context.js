// In-memory resume store — persists for the duration of the app session.
let resume = '';

function getResume() {
  return resume;
}

function setResume(text) {
  resume = text || '';
}

module.exports = { getResume, setResume };
