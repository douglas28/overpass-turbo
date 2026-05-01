/**
 * VENDZ MAPS — Custom Floating Panels for Overpass Turbo
 *
 * This module injects all Vendz-specific UI panels into the Overpass Turbo page:
 *   - Query Editor customisation (float, drag, collapse)
 *   - POI Filter Panel (7-tab OSM category selector)
 *   - veNd-Z Leads Panel (ANZSIC division tabs, GeoJSON overlay)
 *   - BL List Panel (paginated table, CSV export, fly/flag)
 *   - Barney Copilot Panel (AI chat, SQL, voice)
 *   - Visual Explorer (HUD bar + Portal card)
 *   - Map Legend, Branding, Geocode bar, Distance ruler
 *
 * IMPORTANT: This file lives in source (js/) so it survives `pnpm run build`.
 * Never hand-edit dist/index.html for panel code — always edit here.
 */

import "../css/vendz-panels.css";
import {createVendzPanel} from "./vendz-panel-base.js";

// ─── Types ───────────────────────────────────────────────────
declare global {
  interface Window {
    __leaflet_map: any;
    __leaflet_L: any;
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function escHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function getMap(): any {
  let m = window.__leaflet_map;
  // Must be a Leaflet map object with .on method
  if (m && typeof m.on === "function") return m;
  // Fallback: try ide global (set by overpass-turbo's main ide module)
  const ide = (window as any).ide;
  if (ide && ide.map && typeof ide.map.on === "function") {
    window.__leaflet_map = ide.map;
    return ide.map;
  }
  return null;
}
function getL(): any {
  return window.__leaflet_L || (window as any).L || null;
}

function showToast(msg: string, ms = 4000) {
  let t = document.getElementById("vendz-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "vendz-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout((t as any)._tid);
  (t as any)._tid = setTimeout(() => t!.classList.remove("visible"), ms);
}

function makeDraggable(panel: HTMLElement, handle: HTMLElement) {
  let sx = 0,
    sy = 0,
    ox = 0,
    oy = 0,
    dragging = false;
  handle.addEventListener("mousedown", (e) => {
    const tag = ((e.target as HTMLElement).tagName || "").toLowerCase();
    if (["input", "button", "select", "textarea", "a", "label"].includes(tag))
      return;
    if (
      (e.target as HTMLElement).closest("input,button,select,textarea,a,label")
    )
      return;
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    const r = panel.getBoundingClientRect();
    ox = r.left;
    oy = r.top;
    document.documentElement.style.userSelect = "none";
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    let nx = ox + (e.clientX - sx);
    let ny = oy + (e.clientY - sy);
    nx = Math.max(0, Math.min(nx, window.innerWidth - 60));
    ny = Math.max(0, Math.min(ny, window.innerHeight - 40));
    panel.style.setProperty("left", nx + "px", "important");
    panel.style.setProperty("top", ny + "px", "important");
    panel.style.setProperty("right", "auto", "important");
    panel.style.setProperty("bottom", "auto", "important");
  });
  window.addEventListener("mouseup", () => {
    if (dragging) {
      dragging = false;
      document.documentElement.style.userSelect = "auto";
    }
  });
}
// Expose for vendz-panel-base.js
(window as any).makeDraggable = makeDraggable;

// ─── ANZSIC Division Colours & Labels ────────────────────────

const DIVISION_COLORS: Record<string, string> = {
  A: "#43a047",
  B: "#795548",
  C: "#ff7043",
  D: "#fdd835",
  E: "#8d6e63",
  F: "#5c6bc0",
  G: "#26a69a",
  H: "#ef5350",
  I: "#42a5f5",
  J: "#ab47bc",
  K: "#66bb6a",
  L: "#78909c",
  M: "#7e57c2",
  N: "#29b6f6",
  O: "#ec407a",
  P: "#ffa726",
  Q: "#d4e157",
  R: "#26c6da",
  S: "#8d6e63"
};

const DIVISION_LABELS: Record<string, string> = {
  A: "Agriculture",
  B: "Mining",
  C: "Manufacturing",
  D: "Utilities",
  E: "Construction",
  F: "Wholesale",
  G: "Retail",
  H: "Accommodation & Food",
  I: "Transport & Warehousing",
  J: "Info & Telecom",
  K: "Finance & Insurance",
  L: "Real Estate",
  M: "Professional Services",
  N: "Admin & Support",
  O: "Public Admin",
  P: "Education",
  Q: "Health Care",
  R: "Arts & Recreation",
  S: "Other Services"
};

// ─── POI Categories (CATS) ──────────────────────────────────

interface CatItem {
  l: string;
  t: string;
  v: string;
  children?: PoiChildItem[];
}

interface PoiChildItem {
  id: string;
  l: string;
  queryClauses: string[];
  defaultOn?: boolean;
}
interface CatDef {
  label: string;
  items: CatItem[];
}

const CATS: Record<string, CatDef> = {
  vending: {
    label: "Vending",
    items: [
      {
        l: "Gym",
        t: "leisure",
        v: "fitness_centre",
        children: [
          {
            id: "gym:fitness_centre",
            l: "Fitness Centre",
            queryClauses: ['nwr["leisure"="fitness_centre"]({{bbox}});'],
            defaultOn: true
          },
          {
            id: "gym:amenity_gym",
            l: "Amenity Gym",
            queryClauses: ['nwr["amenity"="gym"]({{bbox}});']
          },
          {
            id: "gym:sports_centre",
            l: "Sports Centre",
            queryClauses: [
              'nwr["leisure"="sports_centre"]({{bbox}});',
              'nwr["leisure"="sports_centre"]["sport"~"fitness|gymnastics|pilates|yoga|aerobics|dance"]({{bbox}});'
            ]
          },
          {
            id: "gym:sports_hall",
            l: "Sports Hall",
            queryClauses: ['nwr["leisure"="sports_hall"]({{bbox}});']
          },
          {
            id: "gym:sports_club",
            l: "Sports Club",
            queryClauses: [
              'nwr["leisure"="sports_club"]({{bbox}});',
              'nwr["club"="sport"]({{bbox}});'
            ]
          },
          {
            id: "gym:outdoor",
            l: "Outdoor Gym",
            queryClauses: [
              'nwr["leisure"="fitness_station"]({{bbox}});',
              'nwr["leisure"="outdoor_gym"]({{bbox}});'
            ]
          },
          {
            id: "gym:fitness_sports",
            l: "Fitness Sport Tags",
            queryClauses: [
              'nwr["sport"~"fitness|gymnastics|aerobics|pilates|yoga|crossfit|martial_arts|boxing|kickboxing|mma"]({{bbox}});'
            ]
          }
        ]
      },
      {l: "School", t: "amenity", v: "school"},
      {l: "University", t: "amenity", v: "university"},
      {l: "Hospital", t: "amenity", v: "hospital"},
      {l: "Clinic", t: "amenity", v: "clinic"},
      {l: "Train Station", t: "railway", v: "station"},
      {l: "Bus Station", t: "amenity", v: "bus_station"},
      {l: "Airport", t: "aeroway", v: "aerodrome"},
      {l: "Mall", t: "shop", v: "mall"},
      {l: "Supermarket", t: "shop", v: "supermarket"},
      {l: "Factory", t: "building", v: "industrial"},
      {l: "Warehouse", t: "building", v: "warehouse"},
      {l: "Office", t: "building", v: "office"},
      {l: "Police Station", t: "amenity", v: "police"},
      {l: "Fire Station", t: "amenity", v: "fire_station"},
      {l: "Community Centre", t: "amenity", v: "community_centre"},
      {l: "Library", t: "amenity", v: "library"},
      {l: "Cinema", t: "amenity", v: "cinema"},
      {l: "Sports Centre", t: "leisure", v: "sports_centre"},
      {l: "Swimming Pool", t: "leisure", v: "swimming_pool"},
      {l: "Park", t: "leisure", v: "park"},
      {l: "Campsite", t: "tourism", v: "camp_site"},
      {l: "Hotel", t: "tourism", v: "hotel"},
      {l: "Hostel", t: "tourism", v: "hostel"},
      {l: "Car Dealer", t: "shop", v: "car"},
      {l: "Petrol Station", t: "amenity", v: "fuel"},
      {l: "Rest Area", t: "highway", v: "rest_area"},
      {l: "Pharmacy", t: "amenity", v: "pharmacy"},
      {l: "Dentist", t: "amenity", v: "dentist"},
      {l: "Veterinary", t: "amenity", v: "veterinary"}
    ]
  },
  amenities: {
    label: "Amenities",
    items: [
      {l: "Restaurant", t: "amenity", v: "restaurant"},
      {l: "Fast Food", t: "amenity", v: "fast_food"},
      {l: "Cafe", t: "amenity", v: "cafe"},
      {l: "Bar", t: "amenity", v: "bar"},
      {l: "Bank", t: "amenity", v: "bank"},
      {l: "ATM", t: "amenity", v: "atm"},
      {l: "Post Office", t: "amenity", v: "post_office"},
      {l: "Toilets", t: "amenity", v: "toilets"},
      {l: "Parking", t: "amenity", v: "parking"},
      {l: "Place of Worship", t: "amenity", v: "place_of_worship"},
      {l: "Courthouse", t: "amenity", v: "courthouse"},
      {l: "Prison", t: "amenity", v: "prison"},
      {l: "Social Facility", t: "amenity", v: "social_facility"},
      {l: "Kindergarten", t: "amenity", v: "kindergarten"},
      {l: "College", t: "amenity", v: "college"},
      {l: "Driving School", t: "amenity", v: "driving_school"},
      {l: "Recycling", t: "amenity", v: "recycling"},
      {l: "Marketplace", t: "amenity", v: "marketplace"},
      {l: "Bench", t: "amenity", v: "bench"},
      {l: "Drinking Water", t: "amenity", v: "drinking_water"},
      {l: "Shelter", t: "amenity", v: "shelter"},
      {l: "Fountain", t: "amenity", v: "fountain"},
      {l: "Townhall", t: "amenity", v: "townhall"},
      {l: "Clock", t: "amenity", v: "clock"},
      {l: "EV Charging", t: "amenity", v: "charging_station"},
      {l: "Car Wash", t: "amenity", v: "car_wash"},
      {l: "Childcare", t: "amenity", v: "childcare"},
      {l: "Nursing Home", t: "amenity", v: "nursing_home"}
    ]
  },
  tourism: {
    label: "Tourism",
    items: [
      {l: "Museum", t: "tourism", v: "museum"},
      {l: "Gallery", t: "tourism", v: "gallery"},
      {l: "Hotel", t: "tourism", v: "hotel"},
      {l: "Hostel", t: "tourism", v: "hostel"},
      {l: "Motel", t: "tourism", v: "motel"},
      {l: "Camp Site", t: "tourism", v: "camp_site"},
      {l: "Caravan Site", t: "tourism", v: "caravan_site"},
      {l: "Information", t: "tourism", v: "information"},
      {l: "Viewpoint", t: "tourism", v: "viewpoint"},
      {l: "Attraction", t: "tourism", v: "attraction"},
      {l: "Theme Park", t: "tourism", v: "theme_park"},
      {l: "Zoo", t: "tourism", v: "zoo"},
      {l: "Aquarium", t: "tourism", v: "aquarium"},
      {l: "Picnic Site", t: "tourism", v: "picnic_site"},
      {l: "Artwork", t: "tourism", v: "artwork"},
      {l: "Chalet", t: "tourism", v: "chalet"},
      {l: "Guest House", t: "tourism", v: "guest_house"},
      {l: "Alpine Hut", t: "tourism", v: "alpine_hut"}
    ]
  },
  sports: {
    label: "Sports",
    items: [
      {l: "Sports Centre", t: "leisure", v: "sports_centre"},
      {l: "Swimming Pool", t: "leisure", v: "swimming_pool"},
      {l: "Stadium", t: "leisure", v: "stadium"},
      {l: "Golf Course", t: "leisure", v: "golf_course"},
      {l: "Pitch", t: "leisure", v: "pitch"},
      {l: "Track", t: "leisure", v: "track"},
      {l: "Ice Rink", t: "leisure", v: "ice_rink"},
      {l: "Horse Riding", t: "leisure", v: "horse_riding"},
      {l: "Fitness Centre", t: "leisure", v: "fitness_centre"},
      {l: "Bowling Alley", t: "leisure", v: "bowling_alley"},
      {l: "Water Park", t: "leisure", v: "water_park"},
      {l: "Marina", t: "leisure", v: "marina"},
      {l: "Fishing", t: "leisure", v: "fishing"},
      {l: "Miniature Golf", t: "leisure", v: "miniature_golf"},
      {l: "Playground", t: "leisure", v: "playground"},
      {l: "Dog Park", t: "leisure", v: "dog_park"}
    ]
  },
  shops: {
    label: "Shops",
    items: [
      {l: "Supermarket", t: "shop", v: "supermarket"},
      {l: "Convenience", t: "shop", v: "convenience"},
      {l: "Clothes", t: "shop", v: "clothes"},
      {l: "Electronics", t: "shop", v: "electronics"},
      {l: "Hardware", t: "shop", v: "hardware"},
      {l: "Furniture", t: "shop", v: "furniture"},
      {l: "Books", t: "shop", v: "books"},
      {l: "Car Dealer", t: "shop", v: "car"},
      {l: "Car Parts", t: "shop", v: "car_parts"},
      {l: "Car Repair", t: "shop", v: "car_repair"},
      {l: "Bakery", t: "shop", v: "bakery"},
      {l: "Butcher", t: "shop", v: "butcher"},
      {l: "Hairdresser", t: "shop", v: "hairdresser"},
      {l: "Florist", t: "shop", v: "florist"},
      {l: "Optician", t: "shop", v: "optician"},
      {l: "Pet", t: "shop", v: "pet"},
      {l: "Bicycle", t: "shop", v: "bicycle"},
      {l: "Mobile Phone", t: "shop", v: "mobile_phone"},
      {l: "Department Store", t: "shop", v: "department_store"},
      {l: "Alcohol", t: "shop", v: "alcohol"},
      {l: "Tobacco", t: "shop", v: "tobacco"},
      {l: "Mall", t: "shop", v: "mall"},
      {l: "Garden Centre", t: "shop", v: "garden_centre"},
      {l: "Stationery", t: "shop", v: "stationery"},
      {l: "Toys", t: "shop", v: "toys"},
      {l: "Gift", t: "shop", v: "gift"}
    ]
  },
  food: {
    label: "Food & Drink",
    items: [
      {l: "Restaurant", t: "amenity", v: "restaurant"},
      {l: "Cafe", t: "amenity", v: "cafe"},
      {l: "Fast Food", t: "amenity", v: "fast_food"},
      {l: "Bar", t: "amenity", v: "bar"},
      {l: "Pub", t: "amenity", v: "pub"},
      {l: "Nightclub", t: "amenity", v: "nightclub"},
      {l: "Biergarten", t: "amenity", v: "biergarten"},
      {l: "Ice Cream", t: "amenity", v: "ice_cream"},
      {l: "Food Court", t: "amenity", v: "food_court"},
      {l: "Bakery", t: "shop", v: "bakery"},
      {l: "Deli", t: "shop", v: "deli"},
      {l: "Greengrocer", t: "shop", v: "greengrocer"},
      {l: "Supermarket", t: "shop", v: "supermarket"},
      {l: "Butcher", t: "shop", v: "butcher"},
      {l: "Confectionery", t: "shop", v: "confectionery"}
    ]
  },
  various: {
    label: "Various",
    items: [
      {l: "Vending Machine", t: "amenity", v: "vending_machine"},
      {l: "Recycling", t: "amenity", v: "recycling"},
      {l: "Post Box", t: "amenity", v: "post_box"},
      {l: "Telephone", t: "amenity", v: "telephone"},
      {l: "Waste Basket", t: "amenity", v: "waste_basket"},
      {l: "EV Charging", t: "amenity", v: "charging_station"},
      {l: "Bicycle Parking", t: "amenity", v: "bicycle_parking"},
      {l: "Taxi Stand", t: "amenity", v: "taxi"},
      {l: "Bus Stop", t: "highway", v: "bus_stop"},
      {l: "Traffic Signal", t: "highway", v: "traffic_signals"},
      {l: "Crossing", t: "highway", v: "crossing"},
      {l: "Speed Camera", t: "highway", v: "speed_camera"},
      {l: "Place of Worship", t: "amenity", v: "place_of_worship"},
      {l: "Cemetery", t: "landuse", v: "cemetery"},
      {l: "Allotments", t: "landuse", v: "allotments"},
      {l: "Construction", t: "landuse", v: "construction"},
      {l: "Wind Turbine", t: "generator:source", v: "wind"},
      {l: "Solar Panel", t: "generator:source", v: "solar"}
    ]
  }
};

// ─── Business Leads Tabs ─────────────────────────────────────

interface BizTabDef {
  label: string;
  divs: string[];
}

const BIZ_TABS: Record<string, BizTabDef> = {
  vending_targets: {
    label: "Vending Targets",
    divs: ["C", "I", "P", "Q", "R", "H"]
  },
  industrial: {label: "Industrial", divs: ["C", "E", "D", "B"]},
  logistics: {label: "Logistics", divs: ["I", "F"]},
  corporate: {label: "Corporate", divs: ["K", "J", "M", "N", "L"]},
  public_sector: {label: "Public", divs: ["O", "P", "Q"]},
  retail_food: {label: "Retail & Food", divs: ["G", "H", "S"]},
  primary: {label: "Primary", divs: ["A", "B"]}
};

// ─── State ───────────────────────────────────────────────────

const pfChecked = new Map<string, boolean>();
const pfChildChecked = new Map<string, boolean>();
const pfExpanded = new Set<string>();
let pfActiveTab = "vending";

const blChecked = new Map<string, boolean>();
let blActiveTab = "vending_targets";
let blLeadsLayer: any = null;
let blLastGeoJson: any = null;
let blMinHeadcount = 0;
let blAutoReload = false;
let blAutoTimer: any = null;

let blListPage = 0;
const blPageSize = 15;
let blListSortOrder = "name";

const _vendzFlagged: Record<string, boolean> = {};
const _vendzRouteList: Record<string, any> = {};
let _vendzLockedMarker: any = null;
let _vendzHudTimer: any = null;

let _bnNzbnContext = "";
let _bnChatHistory: Array<{role: string; text: string}> = [];

let _rulerMode = false;
let _rulerPoint: any = null;
let _rulerLine: any = null;

function _poiItemKey(item: CatItem): string {
  return `${item.t}:${item.v}`;
}

function _poiDefaultClause(item: CatItem): string {
  return `nwr["${item.t}"="${item.v}"]({{bbox}});`;
}

function _getChildSelectionCount(item: CatItem): number {
  if (!item.children?.length) return 0;
  return item.children.filter((child) => pfChildChecked.get(child.id)).length;
}

function _isPoiItemChecked(item: CatItem): boolean {
  if (item.children?.length) return _getChildSelectionCount(item) > 0;
  return !!pfChecked.get(_poiItemKey(item));
}

function _isPoiItemFullyChecked(item: CatItem): boolean {
  if (!item.children?.length) return !!pfChecked.get(_poiItemKey(item));
  return _getChildSelectionCount(item) === item.children.length;
}

function _isPoiItemPartial(item: CatItem): boolean {
  if (!item.children?.length) return false;
  const selected = _getChildSelectionCount(item);
  return selected > 0 && selected < item.children.length;
}

function _setPoiItemChildren(
  item: CatItem,
  checked: boolean,
  useDefaults = false
) {
  if (!item.children?.length) return;
  item.children.forEach((child) => {
    const shouldEnable = checked && (!useDefaults || !!child.defaultOn);
    if (shouldEnable) pfChildChecked.set(child.id, true);
    else pfChildChecked.delete(child.id);
  });
}

function _getPfSelectedCount(): number {
  let count = 0;
  Object.values(CATS).forEach((cat) => {
    cat.items.forEach((item) => {
      if (_isPoiItemChecked(item)) count += 1;
    });
  });
  return count;
}

function _getMatchingPoiChildren(
  item: CatItem,
  searchVal: string
): PoiChildItem[] {
  if (!item.children?.length) return [];
  if (!searchVal) return item.children;
  return item.children.filter((child) =>
    child.l.toLowerCase().includes(searchVal)
  );
}

function _shouldRenderPoiItem(item: CatItem, searchVal: string): boolean {
  if (!searchVal) return true;
  if (item.l.toLowerCase().includes(searchVal)) return true;
  return _getMatchingPoiChildren(item, searchVal).length > 0;
}

// ─── Initialise ──────────────────────────────────────────────

export function initVendzPanels() {
  // Wait for Leaflet map to be available and valid
  const check = setInterval(() => {
    const map = getMap();
    if (map) {
      clearInterval(check);
      _buildAllPanels();
    }
  }, 200);
  // Also run after a max wait (panels still work without map)

  setTimeout(() => {
    clearInterval(check);
    if (!document.getElementById("vendz-brand-label")) {
      _buildAllPanels();
    }
  }, 5000);
}

function _buildAllPanels() {
  try {
    _stripDefaultLayout();
    _injectBranding();
    _injectGeocodeBar();
    _injectEditorHeader();
    _injectPoiFilterPanel();
    _injectBizLeadsPanel();
    _injectBlListPanel();
    _injectBarneyPanel();
    _injectHUD();
    _injectPortal();
    _injectLegend();
    _injectCrosshair();
    _injectRulerBtn();
    _injectFlagBadge();
    _injectToast();
    _injectLayerControlsPanel();
    _injectCostModelPanel();
    _injectPlannerPanel();
    _injectPipelineStatusPanel();
    // ─── Cost Model Panel ─────────────────────────────
    function _injectCostModelPanel() {
      // Use the unified panel base
      createVendzPanel({
        id: "cost-model-panel",
        title: "Cost Model",
        headerClass: "cm-header",
        bodyHtml: `<div class=\"cm-body\" id=\"cm-body\"><div style=\"color:#888;padding:12px;\">Cost modeling tools coming soon…</div></div>`,
        footerHtml: "",
        draggable: true,
        toggleBtn: null, // will auto-create
        startOpen: false,
        extraInit: null
      });
    }

    // ─── Planner Panel ─────────────────────────────
    function _injectPlannerPanel() {
      // Use the unified panel base
      createVendzPanel({
        id: "planner-panel",
        title: "Planner",
        headerClass: "pl-header",
        bodyHtml: `<div class=\"pl-body\" id=\"pl-body\"><div style=\"color:#888;padding:12px;\">Planning tools coming soon…</div></div>`,
        footerHtml: "",
        draggable: true,
        toggleBtn: null, // will auto-create
        startOpen: false,
        extraInit: null
      });
    }
    _injectGeocoderHealthPanel();
    _injectHealthDots();
    _injectCompetitorPanel();
    _injectScoringPanel();
    _injectRiskZonesPanel();
    // ─── Competitor Panel ─────────────────────────────
    function _injectCompetitorPanel() {
      // Use the unified panel base
      createVendzPanel({
        id: "competitor-panel",
        title: "Competitor Intelligence",
        headerClass: "comp-header",
        bodyHtml: `<div class=\"comp-body\" id=\"comp-body\"><div style=\"color:#888;padding:12px;\">Competitor analysis tools coming soon…</div></div>`,
        footerHtml: "",
        draggable: true,
        toggleBtn: null, // will auto-create
        startOpen: false,
        extraInit: null
      });
    }

    // ─── Scoring Panel ─────────────────────────────
    function _injectScoringPanel() {
      // Use the unified panel base
      createVendzPanel({
        id: "scoring-panel",
        title: "Scoring",
        headerClass: "sc-header",
        bodyHtml: `<div class=\"sc-body\" id=\"sc-body\"><div style=\"color:#888;padding:12px;\">Scoring tools coming soon…</div></div>`,
        footerHtml: "",
        draggable: true,
        toggleBtn: null, // will auto-create
        startOpen: false,
        extraInit: null
      });
    }

    // ─── Risk Zones Panel ─────────────────────────────
    function _injectRiskZonesPanel() {
      const togBtn = document.createElement("button");
      togBtn.id = "risk-zones-toggle";
      togBtn.textContent = "Risk Zones";
      togBtn.className = "vendz-microtool";
      document.body.appendChild(togBtn);

      const panel = document.createElement("div");
      panel.id = "risk-zones-panel";
      panel.className = "vendz-panel";
      panel.innerHTML =
        '<div class="rz-header"><span>Risk Zones</span><button class="rz-close">×</button></div>' +
        '<div class="rz-body" id="rz-body">' +
        '<div style="color:#888;padding:12px;">Risk zone tools coming soon…</div>' +
        "</div>";
      document.body.appendChild(panel);

      makeDraggable(panel, panel.querySelector(".rz-header")!);
      togBtn.addEventListener("click", () => panel.classList.toggle("open"));
      panel
        .querySelector(".rz-close")!
        .addEventListener("click", () => panel.classList.remove("open"));
    }
    // ─── Layer Controls Panel ─────────────────────────────
    function _injectLayerControlsPanel() {
      // Use the unified panel base
      createVendzPanel({
        id: "layer-controls-panel",
        title: "Layer Controls",
        headerClass: "lc-header",
        bodyHtml: `
        <div class=\"lc-body\" id=\"lc-body\">
          <label><input type=\"checkbox\" id=\"lc-leads\" checked> Business Leads</label><br/>
          <label><input type=\"checkbox\" id=\"lc-poi\" checked> POI Markers</label><br/>
          <label><input type=\"checkbox\" id=\"lc-legend\" checked> Legend</label><br/>
        </div>
      `,
        footerHtml: "",
        draggable: true,
        toggleBtn: null, // will auto-create
        startOpen: false,
        extraInit: (panel) => {
          // Layer toggles
          const leadsBox = document.getElementById("lc-leads");
          const poiBox = document.getElementById("lc-poi");
          const legendBox = document.getElementById("lc-legend");
          if (leadsBox) {
            leadsBox.addEventListener("change", () => {
              if (leadsBox.checked) {
                if (window.blLeadsLayer && getMap())
                  getMap().addLayer(window.blLeadsLayer);
              } else {
                if (window.blLeadsLayer && getMap())
                  getMap().removeLayer(window.blLeadsLayer);
              }
            });
          }
          if (poiBox) {
            poiBox.addEventListener("change", () => {
              const poiLayer = document.getElementById("poi-filter-panel");
              if (poiLayer)
                poiLayer.style.display = poiBox.checked ? "" : "none";
            });
          }
          if (legendBox) {
            legendBox.addEventListener("change", () => {
              const legend = document.getElementById("vendz-legend");
              if (legend)
                legend.style.display = legendBox.checked ? "" : "none";
            });
          }
        }
      });
    }
    _startHealthPolling();
    _restoreFilterState();
    _setupKeyboardShortcuts();
    _setupDarkMode();
    _setupResponsive();
    console.log("[VENDZ] All panels injected successfully");
    // ─── Pipeline Status Panel ─────────────────────────────
    function _injectPipelineStatusPanel() {
      // Toggle button
      const togBtn = document.createElement("button");
      togBtn.id = "pipeline-status-toggle";
      togBtn.textContent = "Pipeline";
      togBtn.className = "vendz-microtool";
      document.body.appendChild(togBtn);

      // Panel
      const panel = document.createElement("div");
      panel.id = "pipeline-status-panel";
      panel.className = "vendz-panel";
      panel.innerHTML =
        '<div class="ps-header"><span>Pipeline Status</span><button class="ps-close">×</button></div>' +
        '<div class="ps-body" id="ps-body">' +
        '  <div class="ps-metrics">' +
        '    <div class="ps-metric"><div class="ps-k">Jobs</div><div class="ps-v" id="ps-jobs-total">-</div></div>' +
        '    <div class="ps-metric"><div class="ps-k">Running</div><div class="ps-v" id="ps-jobs-running">-</div></div>' +
        '    <div class="ps-metric"><div class="ps-k">Failed</div><div class="ps-v" id="ps-jobs-failed">-</div></div>' +
        '    <div class="ps-metric"><div class="ps-k">Queue</div><div class="ps-v" id="ps-geocoder-queue">-</div></div>' +
        "  </div>" +
        '  <div class="ps-controls">' +
        '    <select id="ps-severity" class="ps-select">' +
        '      <option value="all">All</option>' +
        '      <option value="error">Error</option>' +
        '      <option value="warning">Warning</option>' +
        '      <option value="info">Info</option>' +
        "    </select>" +
        '    <input id="ps-search" class="ps-search" placeholder="Filter logs" />' +
        '    <button id="ps-refresh" class="ps-refresh">Refresh</button>' +
        "  </div>" +
        '  <div class="ps-log-list" id="ps-log-list">Loading…</div>' +
        "</div>";
      document.body.appendChild(panel);

      makeDraggable(panel, panel.querySelector(".ps-header")!);

      togBtn.addEventListener("click", () => panel.classList.toggle("open"));
      panel
        .querySelector(".ps-close")!
        .addEventListener("click", () => panel.classList.remove("open"));

      const jobsTotal = document.getElementById("ps-jobs-total") as HTMLElement;
      const jobsRunning = document.getElementById(
        "ps-jobs-running"
      ) as HTMLElement;
      const jobsFailed = document.getElementById(
        "ps-jobs-failed"
      ) as HTMLElement;
      const geocoderQueue = document.getElementById(
        "ps-geocoder-queue"
      ) as HTMLElement;
      const severitySelect = document.getElementById(
        "ps-severity"
      ) as HTMLSelectElement;
      const searchInput = document.getElementById(
        "ps-search"
      ) as HTMLInputElement;
      const refreshBtn = document.getElementById(
        "ps-refresh"
      ) as HTMLButtonElement;
      const logList = document.getElementById("ps-log-list") as HTMLElement;

      let activeStageId = "vendz_master_merge";
      let pending = false;

      function esc(v: any): string {
        return escHtml(String(v ?? ""));
      }

      function renderLogs(entries: any[]) {
        if (!entries.length) {
          logList.innerHTML =
            '<div class="ps-empty">No log lines for selected filters.</div>';
          return;
        }
        logList.innerHTML = entries
          .map((entry) => {
            const sev = String(entry?.severity || "info");
            const text = String(entry?.text || "");
            const ts = String(entry?.timestamp || "");
            return (
              `<div class="ps-line ps-${esc(sev)}">` +
              `<span class="ps-badge">${esc(sev.toUpperCase())}</span>` +
              (ts ? `<span class="ps-ts">${esc(ts)}</span>` : "") +
              `<span class="ps-text">${esc(text)}</span>` +
              `</div>`
            );
          })
          .join("");
      }

      async function refreshPipelinePanel() {
        if (pending) return;
        pending = true;
        try {
          const severity = severitySelect.value || "all";
          const contains = searchInput.value.trim();

          const [jobsResp, geocoderResp] = await Promise.all([
            fetch("http://127.0.0.1:5002/api/pipeline/jobs/summary?limit=200", {
              cache: "no-store"
            }),
            fetch("http://127.0.0.1:5002/api/mcp-geocoder/status", {
              cache: "no-store"
            })
          ]);

          const jobsData = jobsResp.ok ? await jobsResp.json() : {jobs: []};
          const jobs = Array.isArray(jobsData?.jobs) ? jobsData.jobs : [];
          const running = jobs.filter(
            (j: any) => String(j?.status || "").toLowerCase() === "running"
          ).length;
          const failed = jobs.filter(
            (j: any) => String(j?.status || "").toLowerCase() === "failed"
          ).length;

          const runningPipeline = jobs.find(
            (j: any) =>
              String(j?.status || "").toLowerCase() === "running" &&
              String(j?.source || "").toLowerCase() === "pipeline"
          );
          if (runningPipeline?.id) {
            activeStageId = String(runningPipeline.id);
          }

          jobsTotal.textContent = String(jobs.length);
          jobsRunning.textContent = String(running);
          jobsFailed.textContent = String(failed);

          const geocoderData = geocoderResp.ok ? await geocoderResp.json() : {};
          const queueSize = Number(
            geocoderData?.queue_size ??
              (Number(geocoderData?.total_rows || 0) || 0) -
                (Number(geocoderData?.processed_rows || 0) || 0)
          );
          geocoderQueue.textContent = String(Math.max(0, queueSize || 0));

          const params = new URLSearchParams({
            stage_id: activeStageId,
            limit: "200",
            severity
          });
          if (contains) params.set("contains", contains);

          const logsResp = await fetch(
            `http://127.0.0.1:5002/api/pipeline/simple/logs?${params.toString()}`,
            {
              cache: "no-store"
            }
          );
          const logsData = logsResp.ok ? await logsResp.json() : {entries: []};
          const entries = Array.isArray(logsData?.entries)
            ? logsData.entries
            : [];
          renderLogs(entries);
        } catch (err) {
          logList.innerHTML = `<div class="ps-empty">Unable to refresh pipeline status: ${esc(err)}</div>`;
        } finally {
          pending = false;
        }
      }

      refreshBtn.addEventListener("click", () => {
        void refreshPipelinePanel();
      });
      severitySelect.addEventListener("change", () => {
        void refreshPipelinePanel();
      });
      searchInput.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          void refreshPipelinePanel();
        }
      });

      window.setInterval(() => {
        if (!panel.classList.contains("open")) return;
        void refreshPipelinePanel();
      }, 5000);

      // Initial load for immediate visibility on first open.
      void refreshPipelinePanel();
    }

    // ─── Geocoder Health Panel ─────────────────────────────
    function _injectGeocoderHealthPanel() {
      // Use the unified panel base
      createVendzPanel({
        id: "geocoder-health-panel",
        title: "Geocoder Health",
        headerClass: "gh-header",
        bodyHtml: '<div class="gh-body" id="gh-body">Loading…</div>',
        footerHtml: "",
        draggable: true,
        toggleBtn: null, // will auto-create
        startOpen: false,
        extraInit: (panel) => {
          // TODO: Fetch and render geocoder health from API
        }
      });
    }
  } catch (err) {
    console.error("[VENDZ] Panel injection error:", err);
    // Show error visually
    const errDiv = document.createElement("div");
    errDiv.style.cssText =
      "position:fixed;top:60px;left:10px;z-index:99999;background:red;color:white;padding:12px;font-size:14px;border-radius:6px;max-width:500px;";
    errDiv.textContent = "[VENDZ ERROR] " + String(err);
    document.body.appendChild(errDiv);
  }
}

// ─── Layout Strip ────────────────────────────────────────────

function _stripDefaultLayout() {
  const app = document.querySelector(".app");
  if (app) {
    app.classList.remove("portrait", "landscape");
  }
  const ed = document.getElementById("editor");
  if (ed) {
    ed.removeAttribute("style");
  }
  const dv = document.getElementById("dataviewer");
  if (dv) {
    dv.removeAttribute("style");
  }
}

// ─── Branding ────────────────────────────────────────────────

function _injectBranding() {
  const b = document.createElement("div");
  b.className = "vendz-brand";
  b.id = "vendz-brand-label";
  b.textContent = "VENDZ MAPS";
  document.body.appendChild(b);
}

// ─── Geocode Bar ─────────────────────────────────────────────

function _injectGeocodeBar() {
  const bar = document.createElement("div");
  bar.id = "vendz-geocode-bar";
  bar.innerHTML =
    '<input type="text" placeholder="Search location\u2026" id="vendz-geocode-input" />' +
    '<button id="vendz-geocode-go">\uD83D\uDD0D</button>';
  document.body.appendChild(bar);

  const inp = document.getElementById(
    "vendz-geocode-input"
  ) as HTMLInputElement;
  const btn = document.getElementById("vendz-geocode-go")!;
  const doSearch = () => {
    const q = inp.value.trim();
    if (!q) return;
    const map = getMap();
    const bbox = map ? map.getBounds().toBBoxString() : "-47,165,-34,179";
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&viewbox=${bbox}&bounded=0&limit=5`
    )
      .then((r) => r.json())
      .then((results: any[]) => {
        if (!results.length) {
          showToast("No results found");
          return;
        }
        const r = results[0];
        if (map) {
          map.setView([parseFloat(r.lat), parseFloat(r.lon)], 15);
        }
        showToast(r.display_name?.substring(0, 80) || q);
      })
      .catch(() => showToast("Geocode failed"));
  };
  btn.addEventListener("click", doSearch);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

// ─── Editor Header ───────────────────────────────────────────

function _injectEditorHeader() {
  const ed = document.getElementById("editor");
  if (!ed) return;

  const header = document.createElement("div");
  header.id = "editor-float-header";
  header.innerHTML =
    '<div class="efh-title">\u{1F4DD} Query Editor</div>' +
    '<div class="efh-btns">' +
    '<button class="efh-copy" title="Copy query">\uD83D\uDCCB</button>' +
    '<button class="efh-run" id="efh-run-btn">\u25B6 Run</button>' +
    '<button class="efh-clear" id="efh-clear-btn">\u2715 Clear</button>' +
    '<button class="efh-close" id="efh-close-btn">\u00D7</button>' +
    "</div>";
  ed.insertBefore(header, ed.firstChild);

  // Run button
  document.getElementById("efh-run-btn")!.addEventListener("click", () => {
    _triggerNativeRunWhenEditorReady();
  });

  // Clear button
  document.getElementById("efh-clear-btn")!.addEventListener("click", () => {
    _setEditorQuery(
      '[out:json][timeout:5];\nnode["amenity"="__vendz_none__"]({{bbox}});\nout;'
    );
    setTimeout(() => {
      _triggerNativeRunWhenEditorReady();
    }, 100);
  });

  // Copy button
  header.querySelector(".efh-copy")!.addEventListener("click", () => {
    _withCodeMirror((cm) => {
      const value = _safeGetEditorQuery(cm);
      navigator.clipboard
        .writeText(value)
        .then(() => showToast("Query copied"));
    });
  });

  // Close button
  document.getElementById("efh-close-btn")!.addEventListener("click", () => {
    ed.classList.remove("open");
    document.body.classList.add("editor-collapsed");
  });

  // Float restore toolbar
  const ft = document.createElement("div");
  ft.className = "float-toolbar";
  ft.innerHTML = '<button id="vendz-restore-editor">Editor</button>';
  document.body.appendChild(ft);
  document
    .getElementById("vendz-restore-editor")!
    .addEventListener("click", () => {
      ed.classList.add("open");
      document.body.classList.remove("editor-collapsed");
    });

  // Start open (like POI panel)
  ed.classList.add("open");

  // Auto-size CodeMirror to content on first load
  _withCodeMirror((cm) => {
    setTimeout(() => {
      if (_isCodeMirrorReady(cm) && typeof cm.refresh === "function")
        cm.refresh();
    }, 100);

    // Dirty state tracking
    if (typeof cm.on === "function") {
      cm.on("change", () => {
        document.getElementById("efh-run-btn")?.classList.add("dirty");
      });
    }
  });

  // Ctrl+Enter to run
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      _triggerNativeRunWhenEditorReady();
    }
  });
}

// ─── POI Filter Panel ────────────────────────────────────────

function _injectPoiFilterPanel() {
  // Toggle button
  const togBtn = document.createElement("button");
  togBtn.id = "poi-filter-toggle";
  togBtn.textContent = "POIs";
  document.body.appendChild(togBtn);

  // Panel
  const panel = document.createElement("div");
  panel.id = "poi-filter-panel";
  panel.innerHTML =
    '<div class="pf-header"><span>POI Filters</span><button class="pf-close">\u00D7</button></div>' +
    '<input class="pf-search" type="text" placeholder="Search POIs\u2026" />' +
    '<div class="pf-tabs" id="pf-tabs"></div>' +
    '<div class="pf-body" id="pf-body"></div>' +
    '<div class="pf-footer">' +
    '<button class="pf-run" id="pf-run-btn">Run Query</button>' +
    '<button class="pf-clear-all" id="pf-clear-btn">Clear All</button>' +
    '<span class="pf-count" id="pf-count">0 selected</span>' +
    "</div>";
  document.body.appendChild(panel);

  // Drag
  makeDraggable(panel, panel.querySelector(".pf-header")!);

  // Toggle
  togBtn.addEventListener("click", () => {
    panel.classList.toggle("open");
  });
  panel.querySelector(".pf-close")!.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  // Start open by default
  panel.classList.add("open");

  // Render tabs
  const tabsEl = document.getElementById("pf-tabs")!;
  Object.entries(CATS).forEach(([key, cat]) => {
    const tb = document.createElement("button");
    tb.className = "pf-tab" + (key === pfActiveTab ? " active" : "");
    tb.textContent = cat.label;
    tb.dataset.tab = key;
    tb.addEventListener("click", () => {
      pfActiveTab = key;
      tabsEl
        .querySelectorAll(".pf-tab")
        .forEach((t) => t.classList.remove("active"));
      tb.classList.add("active");
      _renderPfBody();
    });
    tabsEl.appendChild(tb);
  });

  // Search
  panel
    .querySelector(".pf-search")!
    .addEventListener("input", () => _renderPfBody());

  // Run button
  document.getElementById("pf-run-btn")!.addEventListener("click", () => {
    const query = _buildPoiQuery();
    if (query) {
      _setQueryAndRun(query);
    }
  });

  // Clear button
  document.getElementById("pf-clear-btn")!.addEventListener("click", () => {
    pfChecked.clear();
    pfChildChecked.clear();
    _renderPfBody();
    _updatePfCount();
    _setQueryAndRun(
      '[out:json][timeout:5];\nnode["amenity"="__vendz_none__"]({{bbox}});\nout;'
    );
    _saveFilterState();
  });

  // Scroll shadows
  _setupScrollShadow(panel.querySelector(".pf-body")!);

  _renderPfBody();
}

function _renderPfBody() {
  const body = document.getElementById("pf-body")!;
  const cat = CATS[pfActiveTab];
  if (!cat) return;
  const searchVal = (
    document.querySelector(".pf-search") as HTMLInputElement
  )?.value
    .toLowerCase()
    .trim();

  let html = '<div class="pf-grid">';
  cat.items.forEach((item) => {
    if (!_shouldRenderPoiItem(item, searchVal)) return;
    const key = _poiItemKey(item);
    const isChecked = _isPoiItemChecked(item);
    const isPartial = _isPoiItemPartial(item);
    const childCount = item.children?.length || 0;
    const selectedChildCount = _getChildSelectionCount(item);
    const expanded =
      item.children?.length &&
      (pfExpanded.has(key) ||
        (!!searchVal && _getMatchingPoiChildren(item, searchVal).length > 0));
    const checked = isChecked ? "checked" : "";
    const cls = [
      "pf-item",
      isChecked ? "checked" : "",
      isPartial ? "partial" : "",
      item.children?.length ? "pf-parent" : ""
    ]
      .filter(Boolean)
      .join(" ");
    const summary = childCount
      ? `<span class="pf-subcount">${selectedChildCount}/${childCount}</span>`
      : "";
    const expandBtn = childCount
      ? `<button type="button" class="pf-expand ${expanded ? "open" : ""}" data-expand-key="${escHtml(key)}" aria-label="Toggle ${escHtml(item.l)} subfilters">▸</button>`
      : '<span class="pf-expand-spacer"></span>';
    html += `<div class="${cls}" data-parent-key="${escHtml(key)}"><label class="pf-item-label"><input type="checkbox" data-key="${escHtml(key)}" ${checked} />${expandBtn}<span class="pf-item-text">${escHtml(item.l)}</span>${summary}</label>`;
    if (childCount && expanded) {
      html += '<div class="pf-children">';
      _getMatchingPoiChildren(item, searchVal).forEach((child) => {
        const childChecked = pfChildChecked.get(child.id) ? "checked" : "";
        const childCls = pfChildChecked.get(child.id)
          ? "pf-child checked"
          : "pf-child";
        html += `<label class="${childCls}"><input type="checkbox" data-child-key="${escHtml(child.id)}" ${childChecked} /> <span>${escHtml(child.l)}</span></label>`;
      });
      html += "</div>";
    }
    html += "</div>";
  });
  html += "</div>";
  html +=
    '<button class="pf-all-toggle" id="pf-all-toggle">All ' +
    escHtml(cat.label) +
    "</button>";
  body.innerHTML = html;

  body.querySelectorAll<HTMLElement>("[data-parent-key]").forEach((el) => {
    const item = cat.items.find(
      (candidate) => _poiItemKey(candidate) === el.dataset.parentKey
    );
    const input = el.querySelector<HTMLInputElement>("input[data-key]");
    if (item?.children?.length && input) {
      input.indeterminate = _isPoiItemPartial(item);
    }
  });

  body.querySelectorAll<HTMLElement>(".pf-expand").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = (e.currentTarget as HTMLElement).dataset.expandKey!;
      if (pfExpanded.has(key)) pfExpanded.delete(key);
      else pfExpanded.add(key);
      _renderPfBody();
      _saveFilterState();
    });
  });

  // Wire checkboxes
  body.querySelectorAll<HTMLInputElement>("input[data-key]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const inp = e.target as HTMLInputElement;
      const key = inp.dataset.key!;
      const item = cat.items.find(
        (candidate) => _poiItemKey(candidate) === key
      );
      if (!item) return;
      if (item.children?.length) {
        if (inp.checked) {
          const hadAnySelected = _getChildSelectionCount(item) > 0;
          _setPoiItemChildren(item, true, !hadAnySelected);
          pfExpanded.add(key);
        } else {
          _setPoiItemChildren(item, false);
        }
      } else if (inp.checked) {
        pfChecked.set(key, true);
      } else {
        pfChecked.delete(key);
      }
      _renderPfBody();
      _updatePfCount();
      _saveFilterState();
    });
  });

  body
    .querySelectorAll<HTMLInputElement>("input[data-child-key]")
    .forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const inp = e.target as HTMLInputElement;
        const childKey = inp.dataset.childKey!;
        if (inp.checked) pfChildChecked.set(childKey, true);
        else pfChildChecked.delete(childKey);
        _renderPfBody();
        _updatePfCount();
        _saveFilterState();
      });
    });

  // All toggle
  document.getElementById("pf-all-toggle")?.addEventListener("click", () => {
    const allChecked = cat.items.every((i) => _isPoiItemFullyChecked(i));
    cat.items.forEach((i) => {
      const key = _poiItemKey(i);
      if (i.children?.length) {
        _setPoiItemChildren(i, !allChecked);
        if (!allChecked) pfExpanded.add(key);
      } else if (allChecked) {
        pfChecked.delete(key);
      } else {
        pfChecked.set(key, true);
      }
    });
    _renderPfBody();
    _updatePfCount();
    _saveFilterState();
  });
}

function _updatePfCount() {
  const el = document.getElementById("pf-count");
  if (el) el.textContent = _getPfSelectedCount() + " selected";
}

function _buildPoiQuery(): string {
  if (_getPfSelectedCount() === 0) return "";
  const clausesSeen = new Set<string>();
  let clauses = "";

  Object.values(CATS).forEach((cat) => {
    cat.items.forEach((item) => {
      const clausesToEmit = item.children?.length
        ? item.children
            .filter((child) => pfChildChecked.get(child.id))
            .flatMap((child) => child.queryClauses)
        : pfChecked.get(_poiItemKey(item))
          ? [_poiDefaultClause(item)]
          : [];

      clausesToEmit.forEach((clause) => {
        if (clausesSeen.has(clause)) return;
        clausesSeen.add(clause);
        clauses += `  ${clause}\n`;
      });
    });
  });
  return `[out:json][timeout:60];\n(\n${clauses});\nout center qt;`;
}

// ─── Business Leads Panel ────────────────────────────────────

function _injectBizLeadsPanel() {
  // Toggle button
  const togBtn = document.createElement("button");
  togBtn.id = "biz-leads-toggle";
  togBtn.textContent = "Leads";
  document.body.appendChild(togBtn);

  // Panel
  const panel = document.createElement("div");
  panel.id = "biz-leads-panel";
  panel.innerHTML =
    '<div class="bl-header"><span>\uD83C\uDFE2 Business Leads</span><button class="bl-close">\u00D7</button></div>' +
    '<div class="bl-tabs" id="bl-tabs"></div>' +
    '<div class="bl-body" id="bl-body"></div>' +
    '<div class="bl-controls">' +
    '<label>Min staff: <span id="bl-hc-label">0</span></label>' +
    '<input type="range" id="bl-min-hc" min="0" max="500" step="5" value="0" />' +
    "</div>" +
    '<div class="bl-footer">' +
    '<button class="bl-load" id="bl-load-btn">Load Leads</button>' +
    '<button class="bl-clear-btn" id="bl-clear-btn">Clear</button>' +
    '<label class="bl-auto-label"><input type="checkbox" id="bl-auto-cb" /> Auto</label>' +
    '<span class="bl-count" id="bl-count">0 on map</span>' +
    "</div>" +
    '<div class="bl-status" id="bl-status">Ready</div>';
  document.body.appendChild(panel);

  // Drag
  makeDraggable(panel, panel.querySelector(".bl-header")!);

  // Toggle
  togBtn.addEventListener("click", () => {
    panel.classList.toggle("open");
  });
  panel.querySelector(".bl-close")!.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  // Start open by default
  panel.classList.add("open");

  // Headcount slider
  const slider = document.getElementById("bl-min-hc") as HTMLInputElement;
  slider.addEventListener("input", () => {
    blMinHeadcount = parseInt(slider.value) || 0;
    document.getElementById("bl-hc-label")!.textContent =
      String(blMinHeadcount);
  });

  // Render tabs
  const tabsEl = document.getElementById("bl-tabs")!;
  Object.entries(BIZ_TABS).forEach(([key, tab]) => {
    const tb = document.createElement("button");
    tb.className = "bl-tab" + (key === blActiveTab ? " active" : "");
    tb.textContent = tab.label;
    tb.dataset.tab = key;
    tb.addEventListener("click", () => {
      blActiveTab = key;
      tabsEl
        .querySelectorAll(".bl-tab")
        .forEach((t) => t.classList.remove("active"));
      tb.classList.add("active");
      _renderBlBody();
      _saveFilterState();
    });
    tabsEl.appendChild(tb);
  });

  // Load / Clear / Auto
  document
    .getElementById("bl-load-btn")!
    .addEventListener("click", () => blLoadLeads());
  document.getElementById("bl-clear-btn")!.addEventListener("click", () => {
    blChecked.clear();
    _renderBlBody();
    _clearLeadsLayer();
    _blSetStatus("Cleared");
    _saveFilterState();
  });
  document.getElementById("bl-auto-cb")!.addEventListener("change", (e) => {
    blAutoReload = (e.target as HTMLInputElement).checked;
    _setupBlAutoReload();
  });

  _setupScrollShadow(panel.querySelector(".bl-body")!);
  _renderBlBody();
}

function _renderBlBody() {
  const body = document.getElementById("bl-body")!;
  const tab = BIZ_TABS[blActiveTab];
  if (!tab) return;

  let html = '<div class="bl-grid">';
  tab.divs.forEach((d) => {
    const key = d;
    const checked = blChecked.get(key) ? "checked" : "";
    const cls = blChecked.get(key) ? "bl-item checked" : "bl-item";
    const label = DIVISION_LABELS[d] || d;
    const color = DIVISION_COLORS[d] || "#999";
    html += `<label class="${cls}"><input type="checkbox" data-div="${escHtml(d)}" ${checked} /><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span> ${escHtml(label)}</label>`;
  });
  html += "</div>";
  html +=
    '<button class="pf-all-toggle" id="bl-all-toggle">All ' +
    escHtml(tab.label) +
    "</button>";
  body.innerHTML = html;

  body.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const inp = e.target as HTMLInputElement;
      const d = inp.dataset.div!;
      if (inp.checked) blChecked.set(d, true);
      else blChecked.delete(d);
      inp.closest(".bl-item")?.classList.toggle("checked", inp.checked);
      _saveFilterState();
    });
  });

  document.getElementById("bl-all-toggle")?.addEventListener("click", () => {
    const allChecked = tab.divs.every((d) => blChecked.get(d));
    tab.divs.forEach((d) => {
      if (allChecked) blChecked.delete(d);
      else blChecked.set(d, true);
    });
    _renderBlBody();
    _saveFilterState();
  });
}

function _blSetStatus(msg: string, type?: string) {
  const el = document.getElementById("bl-status");
  if (el) el.textContent = msg;
  if (type === "error") showToast(msg);
}

function _clearLeadsLayer() {
  const map = getMap();
  if (blLeadsLayer && map) {
    map.removeLayer(blLeadsLayer);
    blLeadsLayer = null;
  }
  blLastGeoJson = null;
  const cnt = document.getElementById("bl-count");
  if (cnt) cnt.textContent = "0 on map";
  _updateLegend([]);
}

function blLoadLeads() {
  const map = getMap();
  const L = getL();
  if (!map || !L) {
    _blSetStatus("Map not ready", "error");
    return;
  }
  const bounds = map.getBounds();
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  const divs = Array.from(blChecked.keys()).join(",");
  if (!divs) {
    _blSetStatus("Select divisions first");
    return;
  }

  _blSetStatus("Loading\u2026");
  const url = `http://localhost:8085/api/leads/geojson?bbox=${bbox}&bics=${divs}&limit=2000&min_headcount=${blMinHeadcount}`;
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((geojson: any) => {
      blLastGeoJson = geojson;
      // Remove old layer
      if (blLeadsLayer) map.removeLayer(blLeadsLayer);

      const activeDivs = new Set<string>();
      const divCounts: Record<string, number> = {};

      blLeadsLayer = L.geoJSON(geojson, {
        pointToLayer: (feature: any, latlng: any) => {
          const p = feature.properties || {};
          const div = (p.industry_code || "S").charAt(0).toUpperCase();
          activeDivs.add(div);
          divCounts[div] = (divCounts[div] || 0) + 1;
          const color = DIVISION_COLORS[div] || "#999";
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: color,
            color: "#fff",
            weight: 1.2,
            fillOpacity: 0.8
          });
        },
        onEachFeature: (feature: any, layer: any) => {
          const p = feature.properties || {};
          layer.on("mouseover", () => _vendzUpdateHUD(p));
          layer.on("mouseout", () => _vendzHideHUD());
          layer.on("click", () => {
            _vendzShowPortal(layer, p);
            /* REQ-03: emit business:selected via vzBus */
            if ((window as any).vzBus) {
              (window as any).vzBus.emit("business:selected", {
                nzbn: p.nzbn || null,
                name: p.trading_name || p.company_name || null,
                lat: feature.geometry?.coordinates?.[1],
                lng: feature.geometry?.coordinates?.[0],
                industry: p.industry_code || null,
                properties: {business: p}
              });
            }
          });
          // Rich popup
          let html = `<b>${escHtml(p.trading_name || p.company_name || "Unknown")}</b><br/>`;
          if (p.nzbn) html += `NZBN: ${escHtml(String(p.nzbn))}<br/>`;
          if (p.industry_desc) html += `${escHtml(p.industry_desc)}<br/>`;
          if (p.address) html += `${escHtml(p.address)}<br/>`;
          if (p.phone) html += `\u260E ${escHtml(p.phone)}<br/>`;
          if (p.email) html += `\u2709 ${escHtml(p.email)}<br/>`;
          if (p.website)
            html += `<a href="${escHtml(p.website)}" target="_blank">\uD83C\uDF10 Website</a>`;
          layer.bindPopup(html, {maxWidth: 300});
        }
      }).addTo(map);

      const count = geojson.features?.length || 0;
      _blSetStatus(`${count} leads loaded`);
      const cnt = document.getElementById("bl-count");
      if (cnt) cnt.textContent = `${count} on map`;
      _updateLegend(Array.from(activeDivs), divCounts);
      _blRenderList();
    })
    .catch((err: Error) => {
      _blSetStatus(`Error: ${err.message}`, "error");
    });
}

function _setupBlAutoReload() {
  const map = getMap();
  if (!map) return;
  if (blAutoTimer) {
    map.off("moveend", blAutoTimer);
    blAutoTimer = null;
  }
  if (blAutoReload) {
    let timeout: any = null;
    blAutoTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => blLoadLeads(), 800);
    };
    if (map && typeof map.on === "function") {
      map.on("moveend", blAutoTimer);
    }
  }
}

// ─── BL List Panel ───────────────────────────────────────────

function _injectBlListPanel() {
  // Toggle button
  const togBtn = document.createElement("button");
  togBtn.id = "bl-list-toggle";
  togBtn.textContent = "\u{1F4CB} List";
  document.body.appendChild(togBtn);

  const panel = document.createElement("div");
  panel.id = "bl-list-panel";
  panel.innerHTML =
    '<div class="bl-list-header"><span>\u{1F4CB} Leads List</span><button class="bl-close" id="bl-list-close">\u00D7</button></div>' +
    '<div class="bl-list-body" id="bl-list-body"><div style="padding:16px;color:#999;text-align:center;">Load leads to see the list</div></div>' +
    '<div class="bl-list-footer">' +
    '<button class="bl-list-export" id="bl-list-csv">\u{1F4E5} CSV</button>' +
    '<button class="bl-list-export-geojson" id="bl-list-geojson">\u{1F30D} GeoJSON</button>' +
    '<select class="bl-list-sort" id="bl-list-sort"><option value="name">Name</option><option value="nzbn">NZBN</option><option value="hc_desc">Headcount \u2193</option><option value="hc_asc">Headcount \u2191</option><option value="industry">Industry</option></select>' +
    '<span class="bl-list-page" id="bl-list-page">—</span>' +
    '<button id="bl-list-prev" style="font-size:10px;padding:3px 8px;border:1px solid #ccc;border-radius:4px;cursor:pointer;">\u25C0</button>' +
    '<button id="bl-list-next" style="font-size:10px;padding:3px 8px;border:1px solid #ccc;border-radius:4px;cursor:pointer;">\u25B6</button>' +
    "</div>";
  document.body.appendChild(panel);

  makeDraggable(panel, panel.querySelector(".bl-list-header")!);

  togBtn.addEventListener("click", () => panel.classList.toggle("open"));
  document.getElementById("bl-list-close")!.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  document
    .getElementById("bl-list-csv")!
    .addEventListener("click", () => _blExportCSV());
  document
    .getElementById("bl-list-geojson")!
    .addEventListener("click", () => _blExportGeoJSON());
  document.getElementById("bl-list-sort")!.addEventListener("change", (e) => {
    blListSortOrder = (e.target as HTMLSelectElement).value;
    blListPage = 0;
    _blRenderList();
  });
  document.getElementById("bl-list-prev")!.addEventListener("click", () => {
    if (blListPage > 0) {
      blListPage--;
      _blRenderList();
    }
  });
  document.getElementById("bl-list-next")!.addEventListener("click", () => {
    blListPage++;
    _blRenderList();
  });
}

function _blRenderList() {
  const body = document.getElementById("bl-list-body")!;
  if (!blLastGeoJson?.features?.length) {
    body.innerHTML =
      '<div style="padding:16px;color:#999;text-align:center;">No leads loaded</div>';
    return;
  }
  let features = [...blLastGeoJson.features];
  // Sort
  features.sort((a: any, b: any) => {
    const pa = a.properties || {};
    const pb = b.properties || {};
    switch (blListSortOrder) {
      case "nzbn":
        return String(pa.nzbn || "").localeCompare(String(pb.nzbn || ""));
      case "hc_desc":
        return (pb.headcount || 0) - (pa.headcount || 0);
      case "hc_asc":
        return (pa.headcount || 0) - (pb.headcount || 0);
      case "industry":
        return (pa.industry_desc || "").localeCompare(pb.industry_desc || "");
      default:
        return (pa.trading_name || pa.company_name || "").localeCompare(
          pb.trading_name || pb.company_name || ""
        );
    }
  });

  const total = features.length;
  const pages = Math.ceil(total / blPageSize);
  if (blListPage >= pages) blListPage = pages - 1;
  if (blListPage < 0) blListPage = 0;
  const start = blListPage * blPageSize;
  const slice = features.slice(start, start + blPageSize);

  let html =
    "<table><thead><tr><th>Name</th><th>NZBN</th><th>Industry</th><th>Staff</th><th>Region</th><th>Actions</th></tr></thead><tbody>";
  slice.forEach((f: any) => {
    const p = f.properties || {};
    const flagged = _vendzFlagged[p.nzbn]
      ? "\u2705 Flagged"
      : "\uD83D\uDEA9 Flag";
    const flagCls = _vendzFlagged[p.nzbn] ? "flagged" : "";
    html += `<tr>
      <td>${escHtml(p.trading_name || p.company_name || "—")}</td>
      <td style="font-family:monospace;font-size:10px;">${escHtml(String(p.nzbn || "—"))}</td>
      <td>${escHtml(p.industry_desc || "—")}</td>
      <td>${p.headcount || "—"}</td>
      <td>${escHtml(p.region || "—")}</td>
      <td>
        <button class="bl-fly-btn" data-lat="${f.geometry?.coordinates?.[1]}" data-lng="${f.geometry?.coordinates?.[0]}" style="font-size:9px;padding:2px 6px;border:1px solid #ccc;border-radius:3px;cursor:pointer;">Fly</button>
        <button class="bl-flag-btn ${flagCls}" data-nzbn="${escHtml(String(p.nzbn || ""))}" style="font-size:9px;padding:2px 6px;border:1px solid #ffcc80;border-radius:3px;cursor:pointer;">${flagged}</button>
      </td>
    </tr>`;
  });
  html += "</tbody></table>";
  body.innerHTML = html;

  const pageEl = document.getElementById("bl-list-page");
  if (pageEl) pageEl.textContent = `${blListPage + 1}/${pages} (${total})`;

  // Wire fly buttons
  body.querySelectorAll(".bl-fly-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lat = parseFloat((btn as HTMLElement).dataset.lat || "0");
      const lng = parseFloat((btn as HTMLElement).dataset.lng || "0");
      const map = getMap();
      if (map && lat && lng) map.setView([lat, lng], 17);
    });
  });

  // Wire flag buttons
  body.querySelectorAll(".bl-flag-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nzbn = (btn as HTMLElement).dataset.nzbn || "";
      if (!nzbn) return;
      _vendzFlagged[nzbn] = !_vendzFlagged[nzbn];
      _blRenderList();
      _updateFlagCount();
    });
  });
}

function _blExportCSV() {
  if (!blLastGeoJson?.features?.length) {
    showToast("No leads to export");
    return;
  }
  const cols = [
    "trading_name",
    "company_name",
    "nzbn",
    "industry_code",
    "industry_desc",
    "address",
    "region",
    "headcount",
    "phone",
    "email",
    "website",
    "entity_type",
    "entity_status"
  ];
  let csv = cols.join(",") + "\n";
  blLastGeoJson.features.forEach((f: any) => {
    const p = f.properties || {};
    csv +=
      cols
        .map((c) => {
          const v = String(p[c] ?? "");
          return `"${v.replace(/"/g, '""')}"`;
        })
        .join(",") + "\n";
  });
  const blob = new Blob([csv], {type: "text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vendz_leads_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast("CSV exported");
}

function _blExportGeoJSON() {
  if (!blLastGeoJson) {
    showToast("No leads to export");
    return;
  }
  const map = getMap();
  const bbox = map ? map.getBounds().toBBoxString() : "unknown";
  const out = {
    ...blLastGeoJson,
    metadata: {
      bbox,
      count: blLastGeoJson.features?.length || 0,
      exported: new Date().toISOString()
    }
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], {
    type: "application/geo+json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vendz_leads_${new Date().toISOString().slice(0, 10)}.geojson`;
  a.click();
  showToast("GeoJSON exported");
}

// ─── Barney Copilot Panel ────────────────────────────────────

function _injectBarneyPanel() {
  // Toggle
  const togBtn = document.createElement("button");
  togBtn.id = "barney-toggle";
  togBtn.textContent = "\uD83E\uDD16 Barney";
  document.body.appendChild(togBtn);

  const panel = document.createElement("div");
  panel.id = "barney-panel";
  panel.innerHTML =
    '<div class="bn-header">' +
    '<div class="bn-dot"></div><span class="bn-title">Barney Copilot</span>' +
    '<div class="bn-wave" id="bn-wave"><div class="bn-wave-bar"></div><div class="bn-wave-bar"></div><div class="bn-wave-bar"></div><div class="bn-wave-bar"></div><div class="bn-wave-bar"></div></div>' +
    '<button class="bn-close" id="bn-close">\u00D7</button>' +
    "</div>" +
    '<div class="bn-nzbn-bar"><input placeholder="NZBN context\u2026" id="bn-nzbn" /><button id="bn-nzbn-go">\uD83D\uDD0D</button></div>' +
    '<div class="bn-log" id="bn-log"></div>' +
    '<div class="bn-presets" id="bn-presets">' +
    '<button class="bn-preset" data-msg="Gyms in Wellington">Gyms in Wellington</button>' +
    '<button class="bn-preset" data-msg="Hospitals near me">Hospitals near me</button>' +
    '<button class="bn-preset" data-msg="Top 10 by headcount">Top 10 by headcount</button>' +
    '<button class="bn-preset" data-msg="Schools in Auckland">Schools in Auckland</button>' +
    '<button class="bn-preset" data-msg="/help">/help</button>' +
    "</div>" +
    '<div class="bn-input-bar">' +
    '<input id="bn-input" placeholder="Ask Barney\u2026" />' +
    '<button class="bn-voice" id="bn-voice">\uD83C\uDFA4</button>' +
    '<button class="bn-send" id="bn-send">Send</button>' +
    "</div>";
  document.body.appendChild(panel);

  makeDraggable(panel, panel.querySelector(".bn-header")!);

  togBtn.addEventListener("click", () => panel.classList.toggle("open"));
  document.getElementById("bn-close")!.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  // NZBN lookup
  document.getElementById("bn-nzbn-go")!.addEventListener("click", () => {
    _bnNzbnContext = (
      document.getElementById("bn-nzbn") as HTMLInputElement
    ).value.trim();
    if (_bnNzbnContext)
      _bnAppendMsg("system", `NZBN context set: ${_bnNzbnContext}`);
  });

  // Send
  const send = () => {
    const inp = document.getElementById("bn-input") as HTMLInputElement;
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = "";
    _bnSendMessage(msg);
  };
  document.getElementById("bn-send")!.addEventListener("click", send);
  document.getElementById("bn-input")!.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  // Presets
  document.getElementById("bn-presets")!.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".bn-preset") as HTMLElement;
    if (btn?.dataset.msg) {
      (document.getElementById("bn-input") as HTMLInputElement).value =
        btn.dataset.msg;
      send();
    }
  });

  // Voice
  document
    .getElementById("bn-voice")!
    .addEventListener("click", () => _bnToggleVoice());

  // Restore chat
  _bnRestoreChatHistory();
}

function _bnAppendMsg(role: string, text: string) {
  const log = document.getElementById("bn-log");
  if (!log) return;
  const div = document.createElement("div");
  div.className = `bn-msg ${role}`;
  div.innerHTML = _bnRenderMarkdown(text);
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  _bnChatHistory.push({role, text});
  if (_bnChatHistory.length > 10) _bnChatHistory.shift();
  _bnSaveChatHistory();
}

function _bnRenderMarkdown(text: string): string {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>')
    .replace(/\n/g, "<br/>");
}

function _bnShowTyping() {
  const log = document.getElementById("bn-log");
  if (!log) return;
  _bnRemoveTyping();
  const d = document.createElement("div");
  d.className = "bn-typing";
  d.id = "bn-typing-indicator";
  d.innerHTML =
    '<div class="bn-typing-dot"></div><div class="bn-typing-dot"></div><div class="bn-typing-dot"></div>';
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}

function _bnRemoveTyping() {
  document.getElementById("bn-typing-indicator")?.remove();
}

function _bnSendMessage(msg: string) {
  _bnAppendMsg("user", msg);
  _bnShowTyping();
  const map = getMap();
  const mapCtx = map
    ? {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bbox: map.getBounds().toBBoxString()
      }
    : null;

  fetch("http://localhost:5002/api/pipeline/simple/barney-dive-chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      message: msg,
      source: "overpass_turbo",
      nzbn_context: _bnNzbnContext || undefined,
      map_context: mapCtx
    })
  })
    .then((r) => r.json())
    .then((data: any) => {
      _bnRemoveTyping();
      if (data.reply) _bnAppendMsg("assistant", data.reply);
      if (data.type === "sql_result" && data.columns && data.rows) {
        _bnRenderSqlTable(data.columns, data.rows);
      }
      if (data.type === "map_poi" && data.poi_filters) {
        _bnActivatePoiFilters(data.poi_filters);
      }
      if (data.results?.length) {
        _bnPlotResults(data.results);
      }
    })
    .catch((err: Error) => {
      _bnRemoveTyping();
      _bnAppendMsg("error", `Error: ${err.message}`);
    });
}

function _bnRenderSqlTable(columns: string[], rows: any[][]) {
  const log = document.getElementById("bn-log");
  if (!log) return;
  const maxRows = Math.min(rows.length, 20);
  let html = '<table class="bn-sql-table"><thead><tr>';
  columns.forEach((c) => (html += `<th>${escHtml(c)}</th>`));
  html += "</tr></thead><tbody>";
  for (let i = 0; i < maxRows; i++) {
    html += "<tr>";
    rows[i].forEach((v) => (html += `<td>${escHtml(String(v ?? ""))}</td>`));
    html += "</tr>";
  }
  html += "</tbody></table>";
  if (rows.length > 20)
    html += `<div style="color:#64748b;font-size:10px;">... and ${rows.length - 20} more rows</div>`;

  // CSV download button
  html +=
    '<button class="bn-sql-csv" style="margin-top:4px;padding:3px 8px;font-size:10px;background:#334155;color:#e2e8f0;border:none;border-radius:4px;cursor:pointer;">\u2B07 CSV</button>';
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  wrapper.querySelector(".bn-sql-csv")?.addEventListener("click", () => {
    let csv = columns.join(",") + "\n";
    rows.forEach((r) => {
      csv +=
        r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",") +
        "\n";
    });
    const blob = new Blob([csv], {type: "text/csv"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `barney_sql_${Date.now()}.csv`;
    a.click();
  });
  log.appendChild(wrapper);
  log.scrollTop = log.scrollHeight;
}

function _bnPlotResults(results: any[]) {
  const map = getMap();
  const L = getL();
  if (!map || !L) return;
  const withCoords = results.filter((r: any) => r.latitude && r.longitude);
  if (!withCoords.length) return;

  const group = L.layerGroup();
  withCoords.forEach((r: any) => {
    L.circleMarker([r.latitude, r.longitude], {
      radius: 7,
      fillColor: "#38bdf8",
      color: "#fff",
      weight: 1.5,
      fillOpacity: 0.9
    })
      .bindPopup(
        `<b>${escHtml(r.trading_name || r.company_name || "Result")}</b><br/>${escHtml(r.address || "")}`
      )
      .addTo(group);
  });
  group.addTo(map);

  _bnAppendMsg(
    "system",
    `\uD83D\uDDFA\uFE0F ${withCoords.length} result(s) plotted on map`
  );
}

function _bnActivatePoiFilters(filters: any[]) {
  pfChecked.clear();
  filters.forEach((f: any) => {
    if (f.tag && f.value) pfChecked.set(`${f.tag}:${f.value}`, true);
  });
  _renderPfBody();
  _updatePfCount();
  const panel = document.getElementById("poi-filter-panel");
  if (panel) panel.classList.add("open");
  const query = _buildPoiQuery();
  if (query) _setQueryAndRun(query);
}

function _bnToggleVoice() {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("Speech not supported in this browser");
    return;
  }
  const btn = document.getElementById("bn-voice")!;
  const wave = document.getElementById("bn-wave")!;

  if (btn.classList.contains("recording")) {
    (btn as any)._recognition?.stop();
    btn.classList.remove("recording");
    wave.classList.remove("active");
    return;
  }

  const rec = new SpeechRecognition();
  rec.lang = "en-NZ";
  rec.interimResults = true;
  rec.continuous = false;
  (btn as any)._recognition = rec;
  btn.classList.add("recording");
  wave.classList.add("active");

  rec.onresult = (e: any) => {
    let transcript = "";
    for (let i = 0; i < e.results.length; i++) {
      transcript += e.results[i][0].transcript;
    }
    if (e.results[e.results.length - 1].isFinal) {
      (document.getElementById("bn-input") as HTMLInputElement).value =
        transcript;
    }
  };
  rec.onend = () => {
    btn.classList.remove("recording");
    wave.classList.remove("active");
  };
  rec.onerror = () => {
    btn.classList.remove("recording");
    wave.classList.remove("active");
  };
  rec.start();
}

function _bnSaveChatHistory() {
  try {
    localStorage.setItem(
      "vendz_bn_chat",
      JSON.stringify(_bnChatHistory.slice(-10))
    );
  } catch {}
}

function _bnRestoreChatHistory() {
  try {
    const raw = localStorage.getItem("vendz_bn_chat");
    if (!raw) return;
    const msgs = JSON.parse(raw);
    msgs.forEach((m: any) => {
      if (m.role && m.text) {
        const log = document.getElementById("bn-log");
        if (!log) return;
        const div = document.createElement("div");
        div.className = `bn-msg ${m.role}`;
        div.innerHTML = _bnRenderMarkdown(m.text);
        log.appendChild(div);
      }
    });
    _bnChatHistory = msgs;
  } catch {}
}

// ─── Visual Explorer HUD ─────────────────────────────────────

function _injectHUD() {
  const hud = document.createElement("div");
  hud.id = "vendz-hud";
  hud.innerHTML =
    '<span class="hud-dot" id="hud-dot"></span>' +
    '<span class="hud-name" id="hud-name">—</span>' +
    '<span class="hud-sep">|</span>' +
    '<span id="hud-nzbn">—</span>' +
    '<span class="hud-sep">|</span>' +
    '<span id="hud-staff">—</span>' +
    '<span class="hud-sep">|</span>' +
    '<span id="hud-match">—</span>';
  document.body.appendChild(hud);
}

function _vendzUpdateHUD(p: any) {
  const hud = document.getElementById("vendz-hud")!;
  clearTimeout(_vendzHudTimer);
  hud.classList.add("visible");
  const div = (p.industry_code || "S").charAt(0).toUpperCase();
  const dot = document.getElementById("hud-dot") as HTMLElement;
  dot.style.background = DIVISION_COLORS[div] || "#999";
  document.getElementById("hud-name")!.textContent =
    p.trading_name || p.company_name || "Unknown";
  document.getElementById("hud-nzbn")!.textContent = p.nzbn
    ? `NZBN: ${p.nzbn}`
    : "—";
  document.getElementById("hud-staff")!.textContent = p.headcount
    ? `Staff: ${p.headcount}`
    : "—";
  const matchEl = document.getElementById("hud-match")!;
  const score = p.linz_match_score ?? p.match_score ?? null;
  if (score !== null) {
    matchEl.textContent = `Match: ${score}%`;
    matchEl.className =
      score >= 80
        ? "hud-match-green"
        : score >= 50
          ? "hud-match-yellow"
          : "hud-match-red";
  } else {
    matchEl.textContent = "Match: —";
    matchEl.className = "hud-match-grey";
  }
}

function _vendzHideHUD() {
  _vendzHudTimer = setTimeout(() => {
    document.getElementById("vendz-hud")?.classList.remove("visible");
  }, 200);
}

// ─── Visual Explorer Portal ──────────────────────────────────

function _injectPortal() {
  const portal = document.createElement("div");
  portal.id = "vendz-portal";
  document.body.appendChild(portal);
}

function _vendzShowPortal(marker: any, p: any) {
  const portal = document.getElementById("vendz-portal")!;
  const div = (p.industry_code || "S").charAt(0).toUpperCase();
  const color = DIVISION_COLORS[div] || "#999";
  const flagged = _vendzFlagged[p.nzbn];
  const score = p.linz_match_score ?? p.match_score ?? null;
  const scoreColor =
    score >= 80 ? "#4caf50" : score >= 50 ? "#ff9800" : "#ef5350";
  const latlng = marker.getLatLng();

  let html = '<div class="vp-header">';
  html += `<div><div class="vp-title">${escHtml(p.trading_name || p.company_name || "Unknown")}</div>`;
  html += `<div class="vp-nzbn">${p.nzbn ? escHtml(String(p.nzbn)) : "—"}</div></div>`;
  html += '<button class="vp-close" id="vp-close">\u00D7</button></div>';
  html += `<div class="vp-body" style="border-left: 4px solid ${color};">`;
  html += `<div class="vp-row"><span class="vp-label">Industry</span><span class="vp-badge" style="background:${color}22;color:${color};">${escHtml(p.industry_desc || div)}</span></div>`;
  if (score !== null) {
    html += `<div class="vp-row"><span class="vp-label">LINZ Match</span><span style="font-weight:600;color:${scoreColor};">${score}%</span></div>`;
    html += `<div class="vp-progress"><div class="vp-progress-fill" style="width:${score}%;background:${scoreColor};"></div></div>`;
  }
  if (p.entity_status) {
    const statusColor = /registered/i.test(p.entity_status)
      ? "#4caf50"
      : /liquid/i.test(p.entity_status)
        ? "#ef5350"
        : "#ff9800";
    html += `<div class="vp-row"><span class="vp-label">Status</span><span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor};margin-right:4px;"></span>${escHtml(p.entity_status)}</span></div>`;
  }
  if (p.address)
    html += `<div class="vp-row"><span class="vp-label">Address</span><span>${escHtml(p.address)}${p.region ? " (" + escHtml(p.region) + ")" : ""}</span></div>`;
  if (p.headcount)
    html += `<div class="vp-row"><span class="vp-label">Staff Est.</span><span class="vp-value">${p.headcount}</span></div>`;
  html += `<div class="vp-row"><span class="vp-label">Location</span><span><a href="https://www.google.com/maps?q=${latlng.lat},${latlng.lng}" target="_blank" style="font-size:10px;color:#1565c0;">\uD83D\uDCCD ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</a></span></div>`;
  if (p.phone)
    html += `<div class="vp-row"><span class="vp-label">\u260E Phone</span><span>${escHtml(p.phone)}</span></div>`;
  if (p.email)
    html += `<div class="vp-row"><span class="vp-label">\u2709 Email</span><span><a href="mailto:${escHtml(p.email)}">${escHtml(p.email)}</a></span></div>`;
  if (p.website)
    html += `<div class="vp-row"><span class="vp-label">\uD83C\uDF10 Website</span><span><a href="${escHtml(p.website)}" target="_blank">${escHtml(p.website)}</a></span></div>`;
  html += "</div>";

  // Actions
  html += '<div class="vp-actions">';
  html += `<button class="vp-flag ${flagged ? "flagged" : ""}" id="vp-flag">${flagged ? "\u2705 Flagged" : "\uD83D\uDEA9 Flag for Outreach"}</button>`;
  html += '<button class="vp-json" id="vp-json-toggle">{} Raw</button>';
  html += "</div>";
  html += `<div class="vp-json-view" id="vp-json-view">${escHtml(JSON.stringify(p, null, 2))}</div>`;

  portal.innerHTML = html;
  portal.classList.add("open");

  // Position near marker
  _vendzPositionPortal(marker);

  // Unlock previous, lock this marker
  if (_vendzLockedMarker) _vendzUnlockMarker(_vendzLockedMarker);
  _vendzLockedMarker = marker;
  if (marker.setRadius) marker.setRadius(9);
  if (marker.setStyle) marker.setStyle({weight: 3, color: color});

  // Wire events
  document
    .getElementById("vp-close")!
    .addEventListener("click", () => _vendzClosePortal());
  document.getElementById("vp-flag")!.addEventListener("click", () => {
    _vendzFlagged[p.nzbn] = !_vendzFlagged[p.nzbn];
    const btn = document.getElementById("vp-flag")!;
    btn.textContent = _vendzFlagged[p.nzbn]
      ? "\u2705 Flagged"
      : "\uD83D\uDEA9 Flag for Outreach";
    btn.classList.toggle("flagged", !!_vendzFlagged[p.nzbn]);
    _updateFlagCount();
    // Ping animation
    const el = marker.getElement?.();
    if (el) {
      el.classList.add("vendz-pinging");
      setTimeout(() => el.classList.remove("vendz-pinging"), 1800);
    }
  });
  document.getElementById("vp-json-toggle")!.addEventListener("click", () => {
    document.getElementById("vp-json-view")!.classList.toggle("open");
  });

  // Reposition on map move
  const map = getMap();
  if (map) {
    const reposition = () => _vendzPositionPortal(marker);
    if (map && typeof map.on === "function") {
      map.on("move", reposition);
    }
    (portal as any)._reposition = reposition;
  }
}

function _vendzPositionPortal(marker: any) {
  const portal = document.getElementById("vendz-portal");
  if (!portal) return;
  const map = getMap();
  if (!map) return;
  const point = map.latLngToContainerPixel
    ? map.latLngToContainerPixel(marker.getLatLng())
    : map.latLngToLayerPoint(marker.getLatLng());
  if (!point) return;
  const px =
    point.x +
    document.getElementById("dataviewer")!.getBoundingClientRect().left;
  const py =
    point.y +
    document.getElementById("dataviewer")!.getBoundingClientRect().top;

  // Prefer right, then left, then above
  portal.classList.remove("anchor-left", "anchor-right", "anchor-above");
  if (px + 380 < window.innerWidth - 20) {
    portal.style.left = px + 16 + "px";
    portal.style.top = py - 60 + "px";
    portal.classList.add("anchor-left");
  } else if (px - 380 > 20) {
    portal.style.left = px - 376 + "px";
    portal.style.top = py - 60 + "px";
    portal.classList.add("anchor-right");
  } else {
    portal.style.left = px - 180 + "px";
    portal.style.top = py - 250 + "px";
    portal.classList.add("anchor-above");
  }
}

function _vendzClosePortal() {
  const portal = document.getElementById("vendz-portal");
  if (!portal) return;
  portal.classList.remove("open");
  if (_vendzLockedMarker) _vendzUnlockMarker(_vendzLockedMarker);
  _vendzLockedMarker = null;
  const map = getMap();
  if (map && (portal as any)._reposition) {
    map.off("move", (portal as any)._reposition);
  }
}

function _vendzUnlockMarker(m: any) {
  if (m.setRadius) m.setRadius(6);
  if (m.setStyle) m.setStyle({weight: 1.2, color: "#fff"});
}

// ─── Map Legend ───────────────────────────────────────────────

function _injectLegend() {
  const legend = document.createElement("div");
  legend.id = "vendz-legend";
  legend.innerHTML =
    '<div class="legend-title">Business Leads</div><div id="vendz-legend-items"></div>';
  document.body.appendChild(legend);
}

function _updateLegend(divs: string[], counts?: Record<string, number>) {
  const legend = document.getElementById("vendz-legend")!;
  const items = document.getElementById("vendz-legend-items")!;
  if (!divs.length) {
    legend.classList.remove("visible");
    return;
  }
  legend.classList.add("visible");
  items.innerHTML = divs
    .sort()
    .map((d) => {
      const cnt = counts?.[d] ? ` (${counts[d]})` : "";
      return `<div class="legend-item"><span class="legend-dot" style="background:${DIVISION_COLORS[d] || "#999"}"></span>${escHtml(DIVISION_LABELS[d] || d)}${cnt}</div>`;
    })
    .join("");
}

// ─── Helper Panels ───────────────────────────────────────────

function _injectCrosshair() {
  const ch = document.createElement("div");
  ch.id = "vendz-crosshair";
  document.body.appendChild(ch);
}

function _injectRulerBtn() {
  const btn = document.createElement("button");
  btn.id = "vendz-ruler-btn";
  btn.textContent = "\uD83D\uDCCF";
  btn.title = "Distance ruler";
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    _rulerMode = !_rulerMode;
    btn.classList.toggle("active", _rulerMode);
    if (!_rulerMode) {
      _rulerPoint = null;
      if (_rulerLine) {
        const map = getMap();
        if (map) map.removeLayer(_rulerLine);
        _rulerLine = null;
      }
    }
  });

  // Map click handler for ruler
  const waitForMap = setInterval(() => {
    const map = getMap();
    const L = getL();
    if (!map || !L) return;
    clearInterval(waitForMap);
    if (map && typeof map.on === "function") {
      map.on("click", (e: any) => {
        if (!_rulerMode) return;
        if (!_rulerPoint) {
          _rulerPoint = e.latlng;
          showToast("Click second point to measure");
        } else {
          const dist = _rulerPoint.distanceTo(e.latlng);
          const label =
            dist > 1000
              ? `${(dist / 1000).toFixed(2)} km`
              : `${Math.round(dist)} m`;
          _rulerLine = L.polyline([_rulerPoint, e.latlng], {
            color: "#ff9800",
            dashArray: "6,6",
            weight: 2
          }).addTo(map);
          showToast(`Distance: ${label}`);
          _rulerPoint = null;
        }
      });
    }
  }, 300);
}

function _injectFlagBadge() {
  const badge = document.createElement("span");
  badge.id = "vendz-flag-count";
  badge.textContent = "0 flagged";
  document.body.appendChild(badge);
}

function _updateFlagCount() {
  const count = Object.values(_vendzFlagged).filter(Boolean).length;
  const badge = document.getElementById("vendz-flag-count")!;
  badge.textContent = `${count} flagged`;
  badge.classList.toggle("visible", count > 0);
}

function _injectToast() {
  if (!document.getElementById("vendz-toast")) {
    const t = document.createElement("div");
    t.id = "vendz-toast";
    document.body.appendChild(t);
  }
}

function _injectHealthDots() {
  const nav = document.querySelector(".navbar-start");
  if (!nav) return;
  const container = document.createElement("div");
  container.className = "vendz-health-dots";
  container.innerHTML =
    '<span class="vendz-health-dot" id="health-dot-leads" title="Leads API"></span>' +
    '<span class="vendz-health-dot" id="health-dot-overpass" title="Overpass API"></span>';
  nav.appendChild(container);
}

function _startHealthPolling() {
  const poll = () => {
    fetch("http://localhost:8085/health", {mode: "cors"})
      .then((r) => r.ok)
      .then((ok) => {
        document.getElementById("health-dot-leads")?.classList.toggle("ok", ok);
        document
          .getElementById("health-dot-leads")
          ?.classList.toggle("fail", !ok);
      })
      .catch(() => {
        document.getElementById("health-dot-leads")?.classList.add("fail");
        document.getElementById("health-dot-leads")?.classList.remove("ok");
      });

    fetch("http://localhost:12345/api/status", {mode: "cors"})
      .then((r) => r.ok)
      .then((ok) => {
        document
          .getElementById("health-dot-overpass")
          ?.classList.toggle("ok", ok);
        document
          .getElementById("health-dot-overpass")
          ?.classList.toggle("fail", !ok);
      })
      .catch(() => {
        document.getElementById("health-dot-overpass")?.classList.add("fail");
        document.getElementById("health-dot-overpass")?.classList.remove("ok");
      });
  };
  poll();
  setInterval(poll, 30000);
}

// ─── Utility ─────────────────────────────────────────────────

function _getCodeMirror(): any {
  const el = document.querySelector(".CodeMirror") as any;
  return el?.CodeMirror || null;
}

function _isCodeMirrorReady(cm: any): boolean {
  return !!(
    cm &&
    typeof cm.getValue === "function" &&
    typeof cm.setValue === "function"
  );
}

function _withCodeMirror(
  onReady: (cm: any) => void,
  attempts = 120,
  delayMs = 50
) {
  const cm = _getCodeMirror();
  if (_isCodeMirrorReady(cm)) {
    onReady(cm);
    return;
  }
  if (attempts <= 0) return;
  setTimeout(() => _withCodeMirror(onReady, attempts - 1, delayMs), delayMs);
}

function _safeEditorText(query: unknown): string {
  return typeof query === "string" ? query : "";
}

function _safeGetEditorQuery(cm: any): string {
  try {
    if (!_isCodeMirrorReady(cm) || typeof cm.getValue !== "function") return "";
    const value = cm.getValue();
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function _setEditorQuery(query: unknown) {
  const safeQuery = _safeEditorText(query);
  _withCodeMirror((cm) => {
    try {
      if (typeof cm.operation === "function") {
        cm.operation(() => cm.setValue(safeQuery));
      } else {
        cm.setValue(safeQuery);
      }
    } catch {
      // Ignore editor lifecycle race conditions; retries are handled by _withCodeMirror.
    }
  });
}

function _triggerNativeRunWhenEditorReady() {
  _withCodeMirror(() => {
    const native = document.querySelector(
      '[data-ide-handler="click:onRunClick"]'
    ) as HTMLElement;
    if (native) native.click();
    document.getElementById("efh-run-btn")?.classList.remove("dirty");
  });
}

function _setQueryAndRun(query: string) {
  const ed = document.getElementById("editor");
  if (ed) {
    ed.classList.add("open");
    document.body.classList.remove("editor-collapsed");
  }
  const safeQuery = _safeEditorText(query);
  _withCodeMirror((cm) => {
    try {
      if (typeof cm.operation === "function") {
        cm.operation(() => cm.setValue(safeQuery));
      } else {
        cm.setValue(safeQuery);
      }
    } catch {
      return;
    }
    // Ensure editor state settles before triggering native run.
    setTimeout(() => {
      _triggerNativeRunWhenEditorReady();
    }, 60);
  });
}

function _saveFilterState() {
  try {
    const state = {
      pfChecked: Object.fromEntries(pfChecked),
      pfChildChecked: Object.fromEntries(pfChildChecked),
      pfExpanded: Array.from(pfExpanded),
      blChecked: Object.fromEntries(blChecked),
      blActiveTab,
      pfActiveTab
    };
    sessionStorage.setItem("vendz_filter_state", JSON.stringify(state));
  } catch {}
}

function _restoreFilterState() {
  try {
    const raw = sessionStorage.getItem("vendz_filter_state");
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.pfChecked)
      Object.entries(state.pfChecked).forEach(([k]) => pfChecked.set(k, true));
    if (state.pfChildChecked)
      Object.entries(state.pfChildChecked).forEach(([k]) =>
        pfChildChecked.set(k, true)
      );
    if (Array.isArray(state.pfExpanded))
      state.pfExpanded.forEach((k: string) => pfExpanded.add(k));
    if (state.blChecked)
      Object.entries(state.blChecked).forEach(([k]) => blChecked.set(k, true));
    if (state.blActiveTab) blActiveTab = state.blActiveTab;
    if (state.pfActiveTab) pfActiveTab = state.pfActiveTab;
    _renderPfBody();
    _updatePfCount();
    _renderBlBody();
  } catch {}
}

function _setupScrollShadow(el: Element) {
  el.addEventListener("scroll", () => {
    const se = el as HTMLElement;
    el.classList.toggle("scroll-top", se.scrollTop > 4);
    el.classList.toggle(
      "scroll-bottom",
      se.scrollTop + se.clientHeight < se.scrollHeight - 4
    );
  });
}

function _setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Shift+C for crosshair
    if (e.shiftKey && e.key === "C") {
      document.getElementById("vendz-crosshair")?.classList.toggle("active");
      const map = getMap();
      if (
        map &&
        document.getElementById("vendz-crosshair")?.classList.contains("active")
      ) {
        const label = document.createElement("div");
        label.id = "vendz-crosshair-label";
        label.style.cssText =
          "position:fixed;top:calc(50% + 22px);left:50%;transform:translateX(-50%);font-size:10px;color:rgba(255,0,0,0.7);z-index:9996;pointer-events:none;font-family:monospace;";
        document.body.appendChild(label);
        const update = () => {
          const c = map.getCenter();
          label.textContent = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
        };
        if (map && typeof map.on === "function") {
          map.on("move", update);
        }
        update();
      } else {
        document.getElementById("vendz-crosshair-label")?.remove();
      }
    }
  });
}

function _setupDarkMode() {
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    document.body.classList.add("dark-theme");
  }
  window
    .matchMedia?.("(prefers-color-scheme: dark)")
    ?.addEventListener("change", (e) => {
      document.body.classList.toggle("dark-theme", e.matches);
    });
}

function _setupResponsive() {
  if (window.innerWidth < 1200) {
    const ed = document.getElementById("editor");
    if (ed) {
      ed.classList.remove("open");
      document.body.classList.add("editor-collapsed");
    }
  }
}
