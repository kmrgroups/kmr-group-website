/* Column layouts shared by the screen editor, PDF and Excel export. w = relative width. */
(function(){
"use strict";
const R = (n,p) => Array.from({length:n},(_,i)=>({k:p+(i+1), label:String(i+1), w:6, type:"read"}));
const FLOW = [["op","Operation ○"],["opi","Operation + inspection ◉"],["insp","Inspection □"],["move","Transport ⇨"],["store","Storage ▽"],["delay","Delay D"]];
const STATUS = ["","Open","In progress","Completed","Not required"];
const CLS = ["","SC","CC","KC"];

const COLS = {
  pfd: { cols:[
    {k:"opNo",label:"Op no.",w:5,type:"num"},{k:"sym",label:"Flow",w:6.5,type:"sel",opts:FLOW,flow:true},{k:"name",label:"Operation",w:14},{k:"desc",label:"Process description",w:20,type:"long"},
    {k:"machine",label:"Machine / equipment",w:12},{k:"product",label:"Product characteristics",w:22,type:"long"},{k:"process",label:"Process characteristics",w:20,type:"long"},
    {k:"cls",label:"Special char.",w:6},{k:"src",label:"Sources of variation",w:12,type:"long"},{k:"remarks",label:"In-house / sub-con",w:8}] },
  pfmea: { groups:[["",1],["STRUCTURE ANALYSIS (STEP 2)",3],["FUNCTION ANALYSIS (STEP 3)",3],["FAILURE ANALYSIS (STEP 4)",4],["RISK ANALYSIS (STEP 5)",6],["OPTIMISATION (STEP 6)",12]],
    cols:[
    {k:"opNo",label:"Op",w:3.5,type:"num"},
    {k:"item",label:"Process item",w:9,type:"long"},{k:"step",label:"Process step / station",w:10,type:"long"},{k:"we",label:"Process work element (4M)",w:9,type:"long"},
    {k:"funcItem",label:"Function of process item",w:10,type:"long"},{k:"funcStep",label:"Function of process step & product characteristic",w:12,type:"long"},{k:"funcWE",label:"Function of work element & process characteristic",w:11,type:"long"},
    {k:"fe",label:"Failure effect (FE)",w:13,type:"long"},{k:"s",label:"S",w:3,type:"num",rating:true},{k:"fm",label:"Failure mode (FM)",w:13,type:"long"},{k:"fc",label:"Failure cause (FC)",w:12,type:"long"},
    {k:"pc",label:"Current prevention control (PC)",w:13,type:"long"},{k:"o",label:"O",w:3,type:"num",rating:true},{k:"dc",label:"Current detection control (DC)",w:13,type:"long"},{k:"d",label:"D",w:3,type:"num",rating:true},{k:"ap",label:"AP",w:3.5,type:"ro",ap:true},{k:"cls",label:"Special char.",w:4.5,type:"sel",opts:CLS},
    {k:"actPrev",label:"Prevention action",w:11,type:"long"},{k:"actDet",label:"Detection action",w:11,type:"long"},{k:"resp",label:"Responsible person",w:7},{k:"target",label:"Target date",w:7,type:"date"},{k:"status",label:"Status",w:6.5,type:"sel",opts:STATUS},
    {k:"taken",label:"Action taken with evidence",w:10,type:"long"},{k:"done",label:"Completion date",w:7,type:"date"},{k:"s2",label:"S",w:3,type:"num",rating:true},{k:"o2",label:"O",w:3,type:"num",rating:true},{k:"d2",label:"D",w:3,type:"num",rating:true},{k:"ap2",label:"AP",w:3.5,type:"ro",ap:true},{k:"remarks",label:"Remarks",w:7,type:"long"}] },
  cp: { groups:[["",3],["CHARACTERISTICS",3],["",1],["METHODS",5],["",2]], cols:[
    {k:"opNo",label:"Part / process no.",w:5.5,type:"num"},{k:"name",label:"Process name / operation description",w:12,type:"long"},{k:"machine",label:"Machine, device, jig, tools for mfg.",w:14,type:"long"},
    {k:"charNo",label:"No.",w:3.5},{k:"product",label:"Product",w:9,type:"long"},{k:"process",label:"Process",w:9,type:"long"},{k:"cls",label:"Special char. class",w:5.5,type:"sel",opts:CLS},
    {k:"spec",label:"Product / process specification / tolerance",w:13,type:"long"},{k:"tech",label:"Evaluation / measurement technique",w:12,type:"long"},{k:"size",label:"Sample size",w:6},{k:"freq",label:"Sample freq.",w:8,type:"long"},{k:"method",label:"Control method",w:12,type:"long"},
    {k:"react",label:"Reaction plan",w:14,type:"long"},{k:"resp",label:"Responsibility",w:7}] },
  setup: { cols:[{k:"charNo",label:"Char. no.",w:4},{k:"char",label:"Characteristic",w:10},{k:"spec",label:"Specification",w:13},{k:"lsl",label:"LSL",w:6,type:"num"},{k:"usl",label:"USL",w:6,type:"num"},{k:"gauge",label:"Gauge / instrument",w:13},...R(5,"r").map(c=>Object.assign(c,{label:"Sample "+c.label})),{k:"result",label:"Result",w:5,type:"ro",result:["r",5]},{k:"remark",label:"Remarks",w:8}],
    params:[{k:"name",label:"Process parameter",w:18},{k:"spec",label:"Specification",w:24},{k:"actual",label:"Actual",w:12},{k:"ok",label:"OK / NG",w:6,type:"sel",opts:["","OK","NG"]}] },
  patrol: { cols:[{k:"charNo",label:"Char. no.",w:4},{k:"char",label:"Characteristic",w:10},{k:"spec",label:"Specification",w:13},{k:"lsl",label:"LSL",w:5.5,type:"num"},{k:"usl",label:"USL",w:5.5,type:"num"},{k:"gauge",label:"Gauge",w:12},{k:"freq",label:"Frequency",w:7},{slots:"t"},{k:"remark",label:"Remarks",w:7}] },
  self:   { cols:[{k:"charNo",label:"Char. no.",w:4},{k:"char",label:"Characteristic",w:10},{k:"spec",label:"Specification",w:13},{k:"lsl",label:"LSL",w:5.5,type:"num"},{k:"usl",label:"USL",w:5.5,type:"num"},{k:"gauge",label:"Gauge",w:12},{slots:"t"},{k:"remark",label:"Remarks",w:7}] },
  pdi:    { cols:[{k:"charNo",label:"Char. no.",w:4},{k:"char",label:"Characteristic",w:10},{k:"spec",label:"Specification",w:14},{k:"lsl",label:"LSL",w:6,type:"num"},{k:"usl",label:"USL",w:6,type:"num"},{k:"gauge",label:"Gauge / method",w:13},...R(5,"s").map(c=>Object.assign(c,{label:"Sample "+c.label})),{k:"result",label:"Result",w:6,type:"ro",result:["s",5]}] },
  sc:     { cols:[{k:"sl",label:"Sl.",w:3,type:"num"},{k:"charNo",label:"Balloon no.",w:4.5},{k:"char",label:"Characteristic",w:10},{k:"spec",label:"Specification",w:13},{k:"cls",label:"Class",w:4,type:"sel",opts:CLS},{k:"sym",label:"Symbol",w:4},{k:"op",label:"Operation",w:13},{k:"gauge",label:"Gauge",w:13},{k:"control",label:"Control method",w:13,type:"long"},{k:"freq",label:"Frequency",w:8},{k:"react",label:"Reaction plan",w:13,type:"long"}] },
  gauges: { cols:[{k:"sl",label:"Sl.",w:3,type:"num"},{k:"id",label:"Gauge ID",w:5.5},{k:"name",label:"Gauge / instrument",w:16},{k:"range",label:"Size / range",w:10},{k:"lc",label:"Least count",w:6},{k:"type",label:"Type",w:6,type:"sel",opts:["Variable","Attribute","Visual","Document"]},{k:"chars",label:"Balloon nos.",w:8},{k:"ops",label:"Used at op",w:7},{k:"calFreq",label:"Calibration frequency",w:7},{k:"calDue",label:"Calibration due",w:7,type:"date"},{k:"location",label:"Location",w:7},{k:"msa",label:"MSA study",w:7},{k:"source",label:"Source",w:7},{k:"master",label:"Operations Master",w:9}] },
  tools:  { cols:[{k:"sl",label:"Sl.",w:3,type:"num"},{k:"id",label:"Tool ID",w:5},{k:"opNo",label:"Op",w:3.5,type:"num"},{k:"machine",label:"Machine",w:11},{k:"desc",label:"Tool description",w:13},{k:"spec",label:"Insert / size / specification",w:15},{k:"holder",label:"Holder",w:10},{k:"grade",label:"Grade",w:10},{k:"life",label:"Tool life",w:8},{k:"remarks",label:"Remarks",w:9}] },
  pokayoke:{ cols:[{k:"sl",label:"Sl.",w:3,type:"num"},{k:"id",label:"PY no.",w:5},{k:"opNo",label:"Op",w:3.5,type:"num"},{k:"op",label:"Operation",w:10},{k:"desc",label:"Poka-yoke description",w:20,type:"long"},{k:"type",label:"Type",w:6.5,type:"sel",opts:["Prevention","Detection"]},{k:"method",label:"Method",w:8},{k:"fm",label:"Failure mode prevented",w:12,type:"long"},{k:"ver",label:"Verification method",w:11,type:"long"},{k:"freq",label:"Verification freq.",w:7},{k:"react",label:"Reaction if not working",w:12,type:"long"},{k:"status",label:"Status",w:6.5,type:"sel",opts:["To implement","Implemented","Verified"]}] },
  machines:{ cols:[{k:"sl",label:"Sl.",w:3,type:"num"},{k:"id",label:"Machine ID",w:5.5},{k:"name",label:"Machine",w:16},{k:"make",label:"Make / model",w:10},{k:"capacity",label:"Capacity",w:14},{k:"cap",label:"Capability",w:7},{k:"ops",label:"Used at op",w:7},{k:"location",label:"Location",w:9},{k:"pm",label:"PM frequency",w:7},{k:"status",label:"Status",w:7,type:"sel",opts:["Available","Under maintenance","To procure"]}] }
};
/* masters in Admin */
const MASTER_COLS = {
  machines:[{k:"id",label:"ID",w:5},{k:"name",label:"Machine",w:16},{k:"make",label:"Make",w:8},{k:"model",label:"Model",w:8},{k:"capacity",label:"Capacity",w:14},{k:"keys",label:"Processes it can do",w:14,type:"keys"},{k:"maxDia",label:"Max size (mm)",w:6,type:"num"},{k:"cap",label:"Capability ± mm",w:6,type:"num"},{k:"location",label:"Location",w:8},{k:"pm",label:"PM frequency",w:7}],
  gauges:[{k:"id",label:"Gauge ID",w:6},{k:"name",label:"Gauge name (as generated)",w:16},{k:"range",label:"Size / range",w:10},{k:"lc",label:"Least count",w:6},{k:"calFreq",label:"Calibration freq.",w:7},{k:"calDue",label:"Calibration due",w:7,type:"date"},{k:"location",label:"Location",w:8}],
  customers:[{k:"name",label:"Customer name",w:14},{k:"code",label:"Supplier code (given by customer)",w:9},{k:"address",label:"Address",w:18,type:"long"},{k:"contact",label:"Contact person / e-mail",w:12},{k:"ccSym",label:"CC symbol",w:5},{k:"scSym",label:"SC symbol",w:5},{k:"approval",label:"Customer engineering approval",w:10}],
  consumables:[{k:"key",label:"Process",w:8,type:"sel"},{k:"items",label:"Consumables (one per line)",w:30,type:"long"}]
};
const KEY_NAMES = {RMI:"Raw material inspection",CUT:"Cutting / sawing",TURN1:"CNC turning OP1",TURN2:"CNC turning OP2",TURN:"CNC turning",VMC:"VMC / HMC",DRILL:"Drilling / tapping",HOB:"Hobbing",BROACH:"Broaching / slotting",CGRIND:"Cylindrical grinding",IGRIND:"Internal grinding",SGRIND:"Surface grinding",HONE:"Honing",DEBURR:"Deburring",WASH:"Washing",MARK:"Marking",FINAL:"Final inspection",PDI:"PDI",PACK:"Packing",HT:"Heat treatment",SURF:"Surface treatment",CRACK:"Crack detection",LEAK:"Leak test"};
function specFor(id, doc){ return (id==="pfmea" && doc && doc.std==="aiag4" && window.PDFmea) ? window.PDFmea.aiag4Spec(CLS) : COLS[id]; }
window.PDSchema = {specFor, COLS, MASTER_COLS, FLOW, STATUS, CLS, KEY_NAMES};
})();
