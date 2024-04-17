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





  // in seconds instead of milliseconds
  let timeNow = Date.now() / 1000;


  // get all the data into one object, tableData
  for (var i = 0; i < rawData.length; i++) {
    let objKeys = Object.keys(rawData[i].items);
    for (var q = 0; q < objKeys.length; q++) {
      tableData.items[objKeys[q]] = rawData[i].items[objKeys[q]];
    }
  }

  // console.log(rawData);

  for (let i = 0; i < Object.keys(tableData.items).length; i++) {
    let id = Object.values(tableData.items)[i].itemID;
    let lvl = getItemLvl(id);
    let name = getItemName(id);
 //   let minPrice = Object.values(tableData.items)[i].minPrice;
 //  let averagePrice = Object.values(tableData.items)[i].averagePrice;
 //   let unitsSold = Object.values(tableData.items)[i].unitsSold;
 //   let recentHistoryCount = Object.values(tableData.items)[i].recentHistoryCount;
//    let totalCostOfSales = Object.values(tableData.items)[i].recentHistory.reduce((sum, listing) => sum + listing.pricePerUnit,0);
//    let averagePricePerUnit = totalCostOfSales / Object.values(tableData.items)[i].recentHistory.length;


/*
    let pricesHistory =  Object.values(tableData.items)[i].recentHistory.map(listing => listing.pricePerUnit);
    pricesHistory.sort((a, b) => a - b);
    let lowMid = Math.floor((pricesHistory.length - 1) / 4);
    let highMid = Math.ceil((pricesHistory.length - 1) * 3 / 4);
    let q1 = pricesHistory[lowMid];
    let q3 = pricesHistory[highMid];
    let iqr = q3 - q1;
    let lowerFence = q1 - 1.5 * iqr;
    let upperFence = q3 + 1.5 * iqr;
    let filteredPrices = pricesHistory.filter(price => price >= lowerFence && price <= upperFence);
    let totalFiltered = filteredPrices.reduce((sum, price) => sum + price, 0);
    let averagePricePerUnit = totalFiltered / filteredPrices.length;
*/
// Sort listings by pricePerUnit

let pricesHistory =  Object.values(tableData.items)[i].entries.map(listing =>({ pricePerUnit: listing.pricePerUnit, quantity: listing.quantity}));
pricesHistory.sort((a, b) => a.pricePerUnit - b.pricePerUnit);

// Calculate total items sold
const totalItems = pricesHistory.reduce((acc, listing) => acc + listing.quantity, 0);
const firstQuartilePosition = 0.25 * totalItems;
const thirdQuartilePosition = 0.75 * totalItems;

let cumulativeCount = 0;
let q1, q3;

// Find weighted quartiles
for (const listing of pricesHistory) {
  cumulativeCount += listing.quantity;
  if (q1 === undefined && cumulativeCount >= firstQuartilePosition) {
    q1 = listing.pricePerUnit;
  }
  if (q3 === undefined && cumulativeCount >= thirdQuartilePosition) {
    q3 = listing.pricePerUnit;
    break;  // Stop iterating once we find Q3
  }
}

const iqr = q3 - q1;

// Calculate outlier thresholds
const lowerFence = q1 - 1.5 * iqr;
const upperFence = q3 + 1.5 * iqr;

// Filter listings based on calculated outlier thresholds
const filteredListings = pricesHistory.filter(listing => 
  listing.pricePerUnit >= lowerFence && listing.pricePerUnit <= upperFence);

// Calculate weighted average without outliers
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

  
// Your Javascript code to create the grid
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
    case "gc":
      items = gcData;
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

// column sort function, fires on refresh TODO: get it to always sort Descending on refresh
function sortCol() {
  const getCellValue = (tr, idx) =>
    tr.children[idx].innerText || tr.children[idx].textContent;

  const comparer = (idx, asc) => (a, b) =>
    ((v2, v1) =>
      v1 !== "" && v2 !== "" && !isNaN(v1) && !isNaN(v2)
        ? v1 - v2
        : v1.toString().localeCompare(v2))(
      getCellValue(asc ? a : b, idx),
      getCellValue(asc ? b : a, idx)
    );

  // do the work...
  document.querySelectorAll("th").forEach((th) =>
    th.addEventListener("click", () => {
      const table = th.closest("table");
      Array.from(table.querySelectorAll("tr:nth-child(n+2)"))
        .sort(
          comparer(
            Array.from(th.parentNode.children).indexOf(th),
            (this.asc = !this.asc)
          )
        )
        .forEach((tr) => table.appendChild(tr));
    })
  );
}

// hook up the fetch to the button
settings.querySelector(".fetch").addEventListener("click", async (e) => {
  e.preventDefault();
  updateLocalSave();
  loadLocalSave();
  fetchData();
});

// accordion functionality for mobile
Array.from(document.querySelectorAll(".accordion-toggle")).map((button) =>
  button.addEventListener("click", function (e) {
    e.preventDefault;
    this.parentNode.nextElementSibling.classList.toggle("hidden");
  })
);

// save to local
function updateLocalSave() {
  let saveState = {
    lang: langSelect.value,
    world: worldSelect.value,
    rType: retainerType.value,
    rLevel: retainerLevel.value,
  };

  localStorage.setItem(`ffFetchSave`, JSON.stringify(saveState));
}
// hookup the onchange event for saving state
Array.from(settings.querySelector("button.fetch")).map((el) =>
  el.addEventListener("click", updateLocalSave)
);

// load from local
function loadLocalSave() {
  let loadState = JSON.parse(localStorage.getItem(`ffFetchSave`));

  langSelect.value = loadState.lang;
  worldSelect.value = loadState.world;
  retainerType.value = loadState.rType;
  retainerLevel.value = loadState.rLevel;

  updateIcons(loadState.rType);
}

// if we have something to load, do it

  loadLocalSave();

