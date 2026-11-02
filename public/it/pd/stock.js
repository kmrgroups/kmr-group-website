/* Process Documents — what the raw material is when it arrives: BAR (cut to length), FORGING BLANK or CASTING BLANK.
   The route, the incoming inspection, the PFMEA failure modes, the Control Plan lines, the work instructions and the poka-yoke list all follow this choice.
     bar      → receiving & inspection, storage, bar cutting / sawing, machining …
     forging  → forging receiving & inspection (laps, cracks, mismatch, hardness, allowance), storage, machining … (no cutting)
     casting  → casting receiving & inspection (porosity, shrinkage, sand, size), storage, FETTLING (gate / riser / parting line), machining …
   PDStock.resolve(choice, notes, header, family) → 'bar' | 'forging' | 'casting'   (an empty choice is detected from the drawing notes, as before) */
(function () {
  "use strict";
  const ROW = (o) => o;   // readability only

  const TYPES = {
    bar: {
      key: "bar", label: "Bar / rod (cut to length)", short: "Bar",
      rmiName: "Raw material receiving & inspection",
      rmiDesc: "Receive raw material, verify MTC (chemistry & mechanical), check size, identify & tag",
      rmiParams: (ctx) => [
        ["Material certificate (MTC)", "Chemical & mechanical properties as per " + (ctx.header.material || "drawing material"), "MTC verification", "Each heat / lot", "QA"],
        ["Raw material size", "As per RM specification", "Vernier caliper", "5 pcs / lot", "QA"]],
      rmCauses: null,                    // null = the standard raw-material cause
      rmiRows: [],
      rmiSteps: null,                    // null = the standard steps
      rmiGauges: [],
      pokayoke: "Material grade colour-coding on bar ends; cutting accepts only matching colour",
      note: "Bar is cut to length at the sawing operation, then machined."
    },

    forging: {
      key: "forging", label: "Forging blank", short: "Forging",
      rmiName: "Forging receiving & inspection",
      rmiDesc: "Receive forged blanks, verify MTC and forging heat-treatment certificate, check blank size, mismatch & flash, visual check for laps, cracks, folds, under-fill & scale, check hardness, identify & tag forging lot / heat no.",
      rmiParams: (ctx) => [
        ["Material certificate (MTC)", "Chemical & mechanical properties as per " + (ctx.header.material || "drawing material"), "MTC verification", "Each heat / lot", "QA"],
        ["Forging heat-treatment condition", "Normalised / quenched & tempered as per forging specification", "Supplier certificate verification", "Each lot", "QA"],
        ["Blank size & machining allowance", "As per forging drawing (allowance on every machined surface)", "Vernier / height gauge", "5 pcs / lot", "QA"],
        ["Die mismatch & flash / parting line", "Within forging drawing limit", "Vernier / mismatch gauge", "5 pcs / lot", "QA"],
        ["Surface defects – laps, cracks, folds, under-fill, scale pits", "No visible defect", "Visual against boundary samples; MPI on sample", "Every piece visual; MPI 1 pc / lot", "QA"],
        ["Forging hardness", "As per forging specification (HB)", "Brinell hardness tester", "3 pcs / lot", "QA"],
        ["Forging weight", "As per forging drawing", "Weighing scale", "5 pcs / lot", "QA"],
        ["Identification – heat / lot no. & die no.", "Marked on blank / container and matches MTC", "Visual", "Each container", "Stores"]],
      rmCauses: null,
      rmiRows: [
        ROW({ we: "Method: supplier forging process", fs: "Accept only forgings free from laps, cracks, folds and under-fill", fwe: "Supplier forges to approved process; inspector checks every blank",
          fe: "Your plant: scrap after machining.\nCustomer: crack grows in service – fatigue failure.\nEnd user: breakage / safety risk in the field.", s: 9, fm: "Forging has lap / crack / fold / under-fill",
          fc: "Billet heating or die filling not in control at supplier", pc: "Supplier PPAP & forging control plan; supplier 100% visual", o: 3, dc: "Visual of every blank against boundary samples; MPI on 1 pc / lot", d: 5 }),
        ROW({ we: "Machine: forging die", fs: "Accept only forgings with enough machining allowance", fwe: "Supplier die within life; inspector checks size & mismatch",
          fe: "Your plant: part does not clean up – scrap.", s: 6, fm: "Blank undersize / mismatch – machining allowance not enough", fc: "Die wear / die mismatch",
          pc: "Die-life monitoring at supplier; size & mismatch check per lot", o: 4, dc: "Size & mismatch check on 5 pcs / lot with vernier / height gauge", d: 5 }),
        ROW({ we: "Method: forging heat treatment", fs: "Accept only forgings in the specified heat-treated condition", fwe: "Supplier normalises / tempers forgings and certifies",
          fe: "Your plant: tool wear, poor surface finish, distortion in later heat treatment.", s: 5, fm: "Forging hardness out of specification", fc: "Forging not normalised / uncontrolled cooling",
          pc: "Forging heat-treatment certificate verified per lot", o: 3, dc: "Brinell hardness on 3 pcs / lot", d: 5 }),
        ROW({ we: "Method: identification", fs: "Keep every lot identified to its heat and die", fwe: "Stores tag each container with heat / lot / die no.",
          fe: "Your plant: mixed material – wrong grade in the product.\nCustomer: wrong material in the field.", s: 8, fm: "Mixed lots / heat numbers", fc: "Container not tagged / lots stored together",
          pc: "Heat / lot tag on every container; FIFO; one lot per bin", o: 3, dc: "Tag and MTC cross-check at receiving", d: 4 })],
      rmiSteps: [
        ["Collect forgings with MTC and forging heat-treatment certificate from the stores receipt", "Heat / lot no. on the tag matches the certificates"],
        ["Verify chemistry, mechanical properties and heat-treated condition on the certificates", "Compare with material and forging specification"],
        ["Inspect every blank visually for laps, cracks, folds, under-fill and excess scale", "Compare with boundary samples; reject on any crack or lap"],
        ["Check blank size, die mismatch and flash on 5 pcs per lot", "Use calibrated vernier / height gauge"],
        ["Check hardness on 3 pcs per lot", "Tester verified with test block"],
        ["Send 1 pc per lot for MPI (crack detection) as per plan", "Record the report"],
        ["Tag the lot OK / hold / reject", "Colour tag + register entry"]],
      rmiGauges: [{ name: "Brinell hardness tester", range: "100–450 HB", lc: "—", type: "Variable" }, { name: "Weighing scale", range: "0–30 kg", lc: "1 g", type: "Variable" }],
      pokayoke: "Heat / lot / die tag matched to the MTC before blanks are released to the machining line; only a tagged lot is accepted into the bin",
      note: "Forging blanks go straight to machining – there is no bar cutting. Locate on the forging datum surfaces in the first operation."
    },

    casting: {
      key: "casting", label: "Casting blank", short: "Casting",
      rmiName: "Casting receiving & inspection",
      rmiDesc: "Receive castings, verify material certificate (chemistry & mechanical), check casting dimensions and wall thickness against the casting drawing, visual check for porosity, blow holes, shrinkage, cold shuts, sand inclusion & cracks, check hardness, identify & tag casting lot / heat no.",
      rmiParams: (ctx) => [
        ["Material certificate (MTC)", "Chemical & mechanical properties as per " + (ctx.header.material || "drawing material"), "MTC verification", "Each heat / lot", "QA"],
        ["Casting dimensions & machining allowance", "As per casting drawing (allowance on every machined surface)", "Vernier / height gauge on surface plate", "5 pcs / lot; full layout at first lot and yearly", "QA"],
        ["Wall thickness / core shift", "Within casting drawing limit", "Vernier / ultrasonic thickness gauge", "5 pcs / lot", "QA"],
        ["Surface defects – blow holes, shrinkage, cold shut, sand inclusion, cracks", "No defect beyond the boundary sample", "Visual against boundary samples", "Every piece", "QA"],
        ["Internal soundness (porosity)", "As per customer / casting drawing grade", "X-ray / dye-penetrant / sectioning at lab", "1 pc / lot or as per control plan", "QA"],
        ["Casting hardness", "As per material specification (HB)", "Brinell hardness tester", "3 pcs / lot", "QA"],
        ["Cleanliness – sand & shot-blast residue", "Free from loose sand and grit", "Visual / air blow-off", "Every piece", "Stores / QA"],
        ["Identification – heat / lot no. & cavity", "On casting / container and matches MTC", "Visual", "Each container", "Stores"]],
      rmCauses: null,
      rmiRows: [
        ROW({ we: "Method: supplier casting process", fs: "Accept only castings free from porosity, blow holes and shrinkage", fwe: "Supplier pours within process window; inspector checks every casting",
          fe: "Your plant: scrap after machining, rework.\nCustomer: leak or strength failure.\nEnd user: leakage / breakage in the field.", s: 8, fm: "Porosity / blow holes / shrinkage in the casting",
          fc: "Gas or shrinkage defects in the casting process", pc: "Supplier process control plan; X-ray sample per lot; leak test after machining", o: 4, dc: "Visual of every casting; X-ray / dye-penetrant on 1 pc / lot at lab", d: 6 }),
        ROW({ we: "Method: mould and pouring", fs: "Accept only castings free from sand inclusion, cold shut and cracks on machined surfaces", fwe: "Supplier fettles and shot-blasts; inspector checks",
          fe: "Your plant: defect exposed on machined surface – scrap.\nCustomer: leakage at sealing face.", s: 6, fm: "Sand inclusion / cold shut / crack shows on machining",
          fc: "Mould or pouring defect", pc: "Supplier 100% visual; boundary samples at receiving", o: 4, dc: "Visual of every casting against boundary samples; first-piece machining check", d: 5 }),
        ROW({ we: "Machine: pattern / core", fs: "Accept only castings with enough machining allowance and wall thickness", fwe: "Supplier pattern within life; inspector checks size",
          fe: "Your plant: part does not clean up – scrap.", s: 6, fm: "Casting out of size – core shift / allowance not enough", fc: "Pattern wear / core shift",
          pc: "Casting layout at first lot and yearly; size check per lot", o: 4, dc: "Size and wall thickness on 5 pcs / lot; yearly full layout", d: 5 }),
        ROW({ we: "Method: casting cooling / heat treatment", fs: "Accept only castings in the specified hardness range", fwe: "Supplier controls cooling and certifies",
          fe: "Your plant: tool wear / poor machinability.", s: 5, fm: "Casting hardness out of specification", fc: "Uncontrolled cooling / wrong chemistry",
          pc: "MTC verified per heat; hardness check per lot", o: 3, dc: "Brinell hardness on 3 pcs / lot", d: 5 }),
        ROW({ we: "Method: identification", fs: "Keep every lot identified to its heat and cavity", fwe: "Stores tag each container",
          fe: "Your plant: mixed material or cavity.\nCustomer: wrong grade in the field.", s: 8, fm: "Mixed lots / cavities / wrong grade", fc: "Container not tagged / lots stored together",
          pc: "Heat / lot tag on every container; FIFO; one lot per bin", o: 3, dc: "Tag and MTC cross-check at receiving", d: 4 })],
      rmiSteps: [
        ["Collect castings with the material certificate from the stores receipt", "Heat / lot no. on the tag matches the certificate"],
        ["Verify chemistry and mechanical properties on the certificate", "Compare with the material standard"],
        ["Inspect every casting visually for porosity, blow holes, shrinkage, cold shuts, sand inclusion and cracks", "Compare with boundary samples; reject on any crack"],
        ["Check casting dimensions and wall thickness on 5 pcs per lot", "Use calibrated vernier / height gauge on the surface plate"],
        ["Check hardness on 3 pcs per lot", "Tester verified with test block"],
        ["Send 1 pc per lot for X-ray / dye-penetrant as per the plan", "Record the lab report"],
        ["Tag the lot OK / hold / reject", "Colour tag + register entry"]],
      rmiGauges: [{ name: "Brinell hardness tester", range: "100–450 HB", lc: "—", type: "Variable" }, { name: "Height gauge", range: "0–300 mm", lc: "0.01 mm", type: "Variable" }],
      pokayoke: "Heat / lot / cavity tag matched to the MTC before castings are released; boundary-sample board at the receiving table",
      note: "Castings need no cutting. They are fettled (gate, riser and parting line) and then machined. Locate on the casting datum points in the first operation.",
      // the extra first operation of a casting
      fettle: {
        key: "FETTLE", name: "Fettling – gate, riser & parting-line removal",
        desc: "Remove gate and riser stubs, flash and parting-line fins; grind casting projections to the template; clean off sand and shot-blast residue",
        machine: "Fettling station (pedestal / belt grinder, workbench)",
        params: [
          ["Gate / riser stub height", "Flush to ≤ 1 mm above the surface (or as per casting drawing)", "Height gauge / template", "Every piece", "Operator"],
          ["Flash & parting-line fin", "Removed flush; no cut into the casting body", "Visual / template", "Every piece", "Operator"],
          ["Cleanliness", "Free from sand, grit and loose particles", "Air blow-off and visual", "Every piece", "Operator"],
          ["Grinding wheel / flap disc condition", "No cracks; replace at the wear mark", "Visual", "Start of shift", "Operator"]],
        tools: [["Flap disc / grinding wheel", "Ø 125 × 6 mm, A24R", "Angle / pedestal grinder", "As per wear"], ["Carbide rotary burr", "Tungsten carbide, cylindrical", "Die grinder", "As per wear"]],
        consumables: ["Grinding wheels / flap discs", "Carbide burrs", "Cotton waste / wipers"],
        steps: [
          ["Take castings from the receiving bin; check the lot tag", "Do not mix lots"],
          ["Remove gate and riser stubs with the cut-off wheel / chipping hammer", "Never cut into the casting body"],
          ["Grind flash and parting-line fins to the template", "Within machining allowance"],
          ["Blow off sand and grit; inspect visually", "Eye, dust and ear protection"],
          ["Place fettled castings in the tray with the lot tag", "Do not mix lots"]],
        ppe: ["Safety shoes", "Safety goggles", "Dust mask", "Ear plugs", "Cut-resistant gloves", "Apron"],
        safety: "Wear dust mask, goggles and ear plugs. Check the wheel guard and speed rating before use. Keep hands away from the wheel.",
        rows: [
          ROW({ we: "Method: fettling", fs: "Remove gate, riser and flash without damaging the casting", fwe: "Operator grinds to the template",
            fe: "Your plant: datum surface damaged – scrap.\nCustomer: part cannot be assembled.", s: 6, fm: "Over-grinding / cut into the casting body", fc: "Operator grinds without template / wrong wheel",
            pc: "Template at the station; operator trained", o: 4, dc: "Visual with template every piece; first-piece check", d: 5 }),
          ROW({ we: "Method: fettling", fs: "Leave the casting free from stubs, fins and sand", fwe: "Operator cleans and blows off",
            fe: "Your plant: stub or fin disturbs fixture seating – bad locating, size out of tolerance.\nCustomer: sand / burr in the assembly.", s: 6, fm: "Gate stub / fin left, sand not removed", fc: "Fettling incomplete; air blow-off skipped",
            pc: "Fettling standard with photo; blow-off step in the work instruction", o: 4, dc: "Visual every piece; first-piece machining check", d: 5 })]
      }
    }
  };

  /* choice → key. A choice that is empty or unknown is detected from the drawing notes (the way it worked before). */
  function resolve(choice, notes, header, family) {
    const c = String(choice || "").toLowerCase();
    if (TYPES[c]) return c;
    const up = (s) => String(s || "").toUpperCase();
    if (notes && notes.casting && !/BAR|ROD|EN\s?\d|C45|SAE/.test(up(header && header.material))) return "casting";
    if (notes && notes.forging) return "forging";
    return "bar";
  }
  window.PDStock = { TYPES, resolve, def: (k) => TYPES[k] || TYPES.bar, LIST: [["", "Detect from the drawing"], ["bar", TYPES.bar.label], ["forging", TYPES.forging.label], ["casting", TYPES.casting.label]] };
})();
