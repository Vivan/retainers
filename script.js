const body = document.querySelector("body");
const endpoint = "https://universalis.app/api/v2";
const settings = document.querySelector(".settings");
const table = document.querySelector(".data-table");
const langSelect = settings.querySelector(".language");
const worldSelect = settings.querySelector(".world");
const retainerType = settings.querySelector(".retainer-type");
const retainerLevel = settings.querySelector(".retainer-level");
const favicon = document.querySelector("head > link:first-of-type");
let gridApi;
let itemList = [];
const favicons = {
  start:
    "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>",
  bot: "🪓",
  hnt: "🏹",
  fsh: "🎣",
  gc: "💵",
  min: "⛏️",
  end: "</text></svg>",
};

const gridOptions = {
  autoSizeStrategy: {
    type: 'fitGridWidth'},
    domLayout: "autoHeight",
  // Row Data: The data to be displayed.
  rowData: itemList,
  // Column Definitions: Defines the columns to be displayed.
  columnDefs: [
    { headerName: "Level", field: "itemLevel",filter: "agNumberColumnFilter" ,floatingFilter: true},
    { headerName: "Name",field: "itemName", cellRenderer: (params) => hyperlinkCellRenderer({ value: params.data })  },
    { headerName: "Average Price",field: "itemAveragePrice" ,valueFormatter: params => numberFormatter(params.data.itemAveragePrice)},
    { headerName: "Amount", field: "itemAmount" },
    { headerName: "Gil/Trip",field: "itemGilPerTrip",valueFormatter: params => numberFormatter(params.data.itemGilPerTrip) },
    { headerName: "Sale Velocity",field: "itemSaleVelocity" ,valueFormatter: params => numberFormatter(params.data.itemSaleVelocity),filter: "agNumberColumnFilter",floatingFilter: true}
  ]
 };

 function hyperlinkCellRenderer(params) {
  return `<a href="https://universalis.app/market/${params.value.itemID}" target="_blank" rel="noopener">${params.value.itemName}</a>`;
}

function numberFormatter(params) {
  var sansDec = params.toFixed(0);
  var formatted = sansDec.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formatted;
}
function updateIcons(ret) {
  favicon.href = `${favicons.start}${favicons[ret]}${favicons.end}`;
}

function getItemName(id) {
  return itemData[id][langSelect.value];
}

function getItemLvl(id) {
  return itemData[id].level;
}



function getBreakpoints(data) {
  let breakpoints = Object.entries(data);
  let amount = breakpoints[0][0];
  for (let i = 0; i < breakpoints.length; i++) {
    if (breakpoints[i][1] <= retainerLevel.value) {
      amount = breakpoints[i][0];
    }
  }
  return amount;
}

function getItemsSlices(items) {
  let list = [];
  for (var i = 0; i < Math.ceil(items.length / 100); i++) {
    list[i] = items.slice(i * 100, (i + 1) * 100).join(",");
  }
  return list;
}


document.addEventListener("DOMContentLoaded", function () {
  var gridDiv = document.querySelector("#myGrid");
  gridApi = agGrid.createGrid(gridDiv, gridOptions);
});

function updateTable(rawData, retType) {


  let tableData = {
    items: {},
  };


  for (var i = 0; i < rawData.length; i++) {
    let objKeys = Object.keys(rawData[i].items);
    for (var q = 0; q < objKeys.length; q++) {
      tableData.items[objKeys[q]] = rawData[i].items[objKeys[q]];
    }
  }


  for (let i = 0; i < Object.keys(tableData.items).length; i++) {
    let id = Object.values(tableData.items)[i].itemID;
    let lvl = getItemLvl(id);
    let name = getItemName(id);

let pricesHistory =  Object.values(tableData.items)[i].entries.map(listing =>({ pricePerUnit: listing.pricePerUnit, quantity: listing.quantity}));
pricesHistory.sort((a, b) => a.pricePerUnit - b.pricePerUnit);

const totalItems = pricesHistory.reduce((acc, listing) => acc + listing.quantity, 0);
const firstQuartilePosition = 0.25 * totalItems;
const thirdQuartilePosition = 0.75 * totalItems;

let cumulativeCount = 0;
let q1, q3;

for (const listing of pricesHistory) {
  cumulativeCount += listing.quantity;
  if (q1 === undefined && cumulativeCount >= firstQuartilePosition) {
    q1 = listing.pricePerUnit;
  }
  if (q3 === undefined && cumulativeCount >= thirdQuartilePosition) {
    q3 = listing.pricePerUnit;
    break;  
  }
}

const iqr = q3 - q1;

const lowerFence = q1 - 1.5 * iqr;
const upperFence = q3 + 1.5 * iqr;

const filteredListings = pricesHistory.filter(listing => 
  listing.pricePerUnit >= lowerFence && listing.pricePerUnit <= upperFence);

const totalFiltered = filteredListings.reduce((sum, listing) => sum + listing.pricePerUnit * listing.quantity, 0);
const totalQuantityFiltered = filteredListings.reduce((sum, listing) => sum + listing.quantity, 0);
const averagePricePerUnit = totalFiltered / totalQuantityFiltered;

    let amount =  getBreakpoints(itemData[id].breakpoints) ;
    let gilPerTrip = amount * averagePricePerUnit;
    let saleVelocity = Object.values(tableData.items)[i].regularSaleVelocity;
 

let item = {
  itemLevel: lvl,
  itemName: name,
  itemID:id,
  itemAveragePrice: averagePricePerUnit,
  itemAmount: amount,
  itemGilPerTrip: gilPerTrip,
  itemSaleVelocity: saleVelocity
}

itemList.push(item);

  }

gridApi.setGridOption("rowData",itemList);
}

async function fetchData() {
  itemList.length = 0;
  let world = worldSelect.value;
  let retType = retainerType.value;
  let items = "";
  let result = [];
  switch (retType) {
    case "bot":
      items = botData;
      break;
    case "min":
      items = minData;
      break;
    case "fsh":
      items = fshData;
      break;
    case "hnt":
      items = hntData;
      break;
  }
  body.classList.add("loading", retType);

  // only 100 items at a time are permitted from the API, so chop chop
  const itemsSlice = getItemsSlices(items);

  // build the promise array, the resp.json() had to be here to work
  const calls = itemsSlice.map((slice) =>
    fetch(`${endpoint}/history/${world}/${slice}?maxSalePrice=5000`).then((resp) => resp.json())
  );
  // get the promise results into new array
  const responses = await Promise.all(calls)
    .then((responses) => {
      responses.map((resp) => result.push(resp));
      updateTable(result, retType);
      body.classList.remove("loading", retType);
    })
    .catch((error) => {
      console.error(`Something's wrong: ${error}`);
      body.classList.add("error");
    });
}

// hook up the fetch to the button
settings.querySelector(".fetch").addEventListener("click", async (e) => {
  e.preventDefault();
  updateLocalSave();
  loadLocalSave();
  fetchData();
});

// save to local
function updateLocalSave() {
  let saveState = {
    lang: langSelect.value,
    world: worldSelect.value,
    rType: retainerType.value,
    rLevel: retainerLevel.value,
  };

  localStorage.setItem(`retainerventuresave`, JSON.stringify(saveState));
}
// hookup the onchange event for saving state
Array.from(settings.querySelector("button.fetch")).map((el) =>
  el.addEventListener("click", updateLocalSave)
);

// load from local
function loadLocalSave() {
  let loadState = JSON.parse(localStorage.getItem(`retainerventuresave`));

  langSelect.value = loadState.lang;
  worldSelect.value = loadState.world;
  retainerType.value = loadState.rType;
  retainerLevel.value = loadState.rLevel;

  updateIcons(loadState.rType);
}

// if we have something to load, do it

  loadLocalSave();

