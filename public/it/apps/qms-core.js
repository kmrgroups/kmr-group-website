/* QMS Learning Guide - content registry. Content files (qms-iso-*.js, qms-iatf-*.js, ...) call QMS.add(standard, chapter, entries).
   Every clause is written in plain words (a paraphrase, not the published wording): read it next to your licensed copy of the standard. */
(function () {
  "use strict";
  const STD = {};
  window.QMS = {
    STD,
    /* a standard: key, short name, full name, edition, what it is for, one chapter list */
    std(key, o) { STD[key] = Object.assign({ key, chapters: [], clauses: [] }, o); },
    chapter(key, no, title, intro) { STD[key].chapters.push({ no: String(no), title, intro }); },
    /* c clause, t title, r requirement in plain words, m what it means, h how to implement (steps), d documents to maintain, e records to keep, x sample example, f where it comes from, a app that should hold it */
    add(key, list) { list.forEach((a) => { const [c, t, r, m, h, d, e, x, f, a2] = a; STD[key].clauses.push({ c, t, r, m, h, d, e, x, f: f || "", a: a2 || "" }); }); }
  };
})();
