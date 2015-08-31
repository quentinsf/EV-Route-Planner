/**

    EV Route Planner - A router planner for electric cars

    Copyright (C) 2014, 2015  Paul Churchley

    EV Route Planner is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    EV Route Planner is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

    Full details of license can be found here: http://www.gnu.org/licenses/gpl-3.0.en.html

**/

var map;            // ref to google.maps.Map
var mapDiv;         // ref to the div in the html
var mapDirections;  // ref to the div in the html for the directions
var gdir;           // used in drawing hte route
var currentZoom = 7;

var chart = null;
var SAMPLES = 512;
var mousemarker = null;
var chartData;

var startMarker;    // ref to google.maps.Marker for the start location
var endMarker;      // ref to google.maps.Marker for the end location
var fromLatLng;     // ref to google.maps.LatLng of start location
var toLatLng;       // ref to google.maps.LatLng of end location

var enteredFrom;
var enteredTo;
var enteredRange;
var enteredPercRange;
var enteredChargerLevel;
var enteredConnectors;
var currentFrom;
var currentTo;
var currentRange;
var currentPercRange;
var currentChargerLevel = 'rapid';
var currentConnectors = 'CHAdeMO';

var locale = 'en-gb';

var myOCM;

var myOCMoptions;
var OCMRefData;

var OCMIds = [];

var directionsDisplay;
var directionsReturn;
var directionsService = new google.maps.DirectionsService();
var mapOrigin = new google.maps.LatLng(52.478379, -1.892986); // Centre initially on Birmingham
var addressLatLng = mapOrigin;
var routeWaypoints;
var routeStops;
var routeIndex = 0;
var markersArray = [];
var markerInfoBoxArray = [];
var markersIDArray = [];
var stopMarkers = [];

var startingSOCPerc = 100;
var DetailedDirectionsVisible = false;
var PowerDetailsVisible = true;

var addingID;

var googleIconBase = 'http://google-maps-icons.googlecode.com/files/';
var chargingStopIcon = 'red';
var nonChargingStopIcon = 'darkblue';

var iconRapid = 'graphics/charger-rapid-dc.png';
var iconSlow = 'graphics/charger-rapid-ac.png';
var iconFast = 'graphics/charger-fast.png';
var iconUnknown = 'graphics/charger-unknown-level.png';
var iconStart = 'graphics/home1.png';
var iconDestination = 'graphics/home2.png';

var infoBaseURL = 'http://openchargemap.org/site/poi/details/';
var infoWindow;

var whichPressed;

var openInfoBox;
var openRightClickBox;
var openStopListInfoBox;

var rightClickLat, rightClickLng;

var rangeCircle;
var percRangeCircle;
var circleLatLng;

var selectedLevel;

var myRoute;

var appMode = {
    NOROUTE: 'NOROUTE',                 // No Route yet built. Prior to pressing GETDIRECTIONS
    CHARGERSCHANGED: 'CHARGERSCHANGED', // Chargers to display have changed, powerlevel or supplier, connector etc
    RANGECHANGED: 'RANGECHANGED',       // Range Changed so rebuild circle and OCM locations
    CHARGEADDED: 'CHARGEADDED',         // Charger added to route   
    GETDIRECTIONS: 'GETDIRECTIONS',     // Route built and ready to add charge stops
    NEWROUTE: 'NEWROUTE',               // Change of start/end or criteria (fastest, shortest etc
    FINETUNE: 'FINETUNE',               // Fine tune button pressed, only allow fine tune functions
    RESET: 'RESET'                      // Reset pressed. Clear map, clear waypoints, clear start end, 
}
var thisMode = appMode.NOROUTE;         // holds current mode for the app

var rendererOptionsDraggable = {
    draggable: true,
    suppressMarkers: true
};

var rendererOptionsNonDraggable = {
    draggable: false,
    suppressMarkers: true
};

var percRangeSlider;

var mapOptions = {
    center: mapOrigin, // Birmingham at start
    zoom: currentZoom,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: true,
    scaleControl: true,
    overviewMapControl: true,
    overviewMapControlOptions: {
        opened: true
    }
};

// Load the Visualization API and the piechart package.
google.load('visualization', '1', { packages: ['columnchart'] });

// Set a callback to run when the Google Visualization API is loaded.
google.setOnLoadCallback(initializeVisualisation);

/**
 * Loads initial map. 
 * 
 * Sets up event listeners on the map and directions
 *
 */
function loadMap() {

    getPageElements();

    myRoute = new Route();

    // Generate map
    map = new google.maps.Map(mapDiv, mapOptions);
    directionsDisplay = new google.maps.DirectionsRenderer(rendererOptionsNonDraggable);
    directionsDisplay.setMap(map);

    updateOptions();
    setUpListeners();
}

function setUpListeners() {

    // close infoboxes if map clicked
    google.maps.event.addListener(map, 'click', function (event) {
        closeOpenInfoBox();
        closeRightClickBox();
    });

    // Open Start/End info box
    google.maps.event.addListener(map, 'rightclick', function (event) {
        closeAllInfoBoxes();
        showRightClickBox(event)
    });

    // Listen for route changes & recalc totals
    google.maps.event.addListener(directionsDisplay, 'directions_changed', function (event) {
        var myDirections = directionsDisplay.getDirections();
        computeTotalDistance(myDirections);
        computeTotalTimekWh(myDirections);
        setElevationChart(myDirections.routes[0].overview_path);
    });

    // Resize charge when window resizes
    if (document.addEventListener) {
        window.addEventListener('resize', drawChart);
    }
    else if (document.attachEvent) {
        window.attachEvent('onresize', drawChart);
    }
    else {
        window.resize = drawChart;
    }
}

function initializeVisualisation() {
    elevationService = new google.maps.ElevationService();

    chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));

    google.visualization.events.addListener(chart, 'onmouseover', function (e) {
        if (mousemarker == null) {
            mousemarker = new google.maps.Marker({
                position: elevations[e.row].location,
                map: map,
                icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
            });
        } else {
            mousemarker.setPosition(elevations[e.row].location);
        }
    });
}
function doOnLoad_map1() {

    percRangeSlider = new dhtmlXSlider({
        parent: 'percRangeSlider',
        step: 1,
        min: 20,
        max: 90,
        value: 80,
        linkTo: 'percRange'
    });

    percRangeSlider.attachEvent('onChange', function (newValue, sliderObj) {
        if (thisMode != appMode.NOROUTE) {
            enteredPercRange = routeForm.percRange.value;
            currentPercRange = enteredPercRange;

            clearPercRangeCircle();
            setPercRangeCircle(circleLatLng);
        }
    });

    $body = $('body');
    $('#directionsDiv').hide();
}

function doOnUnload_map1() {
    if (percRangeSlider != null) {
        percRangeSlider.unload();
        percRangeSlider = null;
    }
}

function chargerLevelChanged() {
    if (thisMode != appMode.NOROUTE && thisMode != appMode.RESET && thisMode != appMode.FINETUNE)
        getRouteDirections();
}

function showRightClickBox(event) {

    // create and display rightclick box
    var html = buildRightClickBoxHtml();

    rightClickLat = event.latLng.lat();
    rightClickLng = event.latLng.lng();

    var myLatlng = new google.maps.LatLng(rightClickLat, rightClickLng);

    RightClickInfoBox = new InfoBox({
        content: html
        , position: myLatlng
        , boxStyle: {
            background: 'white'
           , border: '1px solid black'
        }
        , pixelOffset: new google.maps.Size(-20, -30)
    });

    RightClickInfoBox.open(map);
    openRightClickBox = RightClickInfoBox;
}

function setStartLocationFromButton(thisBtn) {

    routeForm.from.value = rightClickLat + ', ' + rightClickLng;

    circleLatLng = { lat: rightClickLat, lng: rightClickLng };

    var LatLng = new google.maps.LatLng(rightClickLat, rightClickLng);

    getFormattedAddressFromLatLng(LatLng, function (formatted_address) {
        routeForm.from.value = formatted_address;

        if (thisMode == appMode.GETDIRECTIONS || thisMode == appMode.NEWROUTE)
            rebuildRoute();

        setStartMarker(LatLng);
    });

    closeRightClickBox();
}

function setEndLocationFromButton(thisBtn) {

    // reverse code the lat lng
    routeForm.to.value = rightClickLat + ', ' + rightClickLng;

    var LatLng = new google.maps.LatLng(rightClickLat, rightClickLng);

    getFormattedAddressFromLatLng(LatLng, function (formatted_address) {
        routeForm.to.value = formatted_address;

        if (thisMode != appMode.NOROUTE)
            rebuildRoute();

        setEndMarker(LatLng);
    });

    closeRightClickBox();
}

function setStartLocationFromText(event) {
    if (thisMode != appMode.NOROUTE) {
        if ((event.type == 'keypress' && event.keyCode == 13)
        || event.type == 'change') {
            rebuildRoute();
        }
    }
}

function setEndLocationFromText(event) {
    if (thisMode != appMode.NOROUTE) {
        if ((event.type == 'keypress' && event.keyCode == 13)
        || event.type == 'change') {
            rebuildRoute();
        }
    }
}

function setStartMarker(LatLng) {
    if (startMarker) startMarker.setMap(null);

    startMarker = new google.maps.Marker({
        position: LatLng,
        map: map,
        optimized: false,
        icon: iconStart
    });

    google.maps.event.addListener(startMarker, 'click', function () {
        circleLatLng = { lat: fromLatLng.lat(), lng: fromLatLng.lng() };
        rebuildRoute();
    });

}

function setStopMarkers() {

    routeStops = myRoute.getAllStops();

    $.each(routeStops, function (index, stop) {

        var iconURL = setStopMarkerType(stop.type, index);
        var latLong = stop.position;

        var stopMarker = new google.maps.Marker({
            position: latLong,
            map: map,
            optimized: false,
            icon: iconURL
        });

        stopMarkers.push(stopMarker);

    });
}

function setStopMarkerType(stopType, i) {
    var iconURL;
    switch (stopType) {
        case StopType.CHARGING:
            iconURL = googleIconBase + chargingStopIcon + leftPad(i + 1, 2) + '.png';
            break;
        case StopType.NONCHARGING:
            iconURL = googleIconBase + nonChargingStopIcon + leftPad(i + 1, 2) + '.png';
            break;
    }
    return iconURL;
}

function setEndMarker(LatLng) {
    if (endMarker) endMarker.setMap(null);

    endMarker = new google.maps.Marker({
        position: LatLng,
        map: map,
        optimized: false,
        icon: iconDestination

    });

    google.maps.event.addListener(endMarker, 'click', function () {
        circleLatLng = { lat: toLatLng.lat(), lng: toLatLng.lng() };
        rebuildRoute();
    });
}

function buildRightClickBoxHtml() {

    var html = '<div><u><h3>Tasks</h3></u>'
        + '<table>'
        + '<tr><td>'
        + '<form id="rightClickForm">'
        + '<button id="startBtn" onClick="setStartLocationFromButton(this);">Set as Start Location</button>'
        + '<button id="endBtn" onClick="setEndLocationFromButton(this);">Set as End Location</button>';

    if (routeStops && routeStops.length > 0) {
        html = html + '<br /><br /><button id="DisplayDeleteStopList" onClick="displayDeleteStopList(this);">List/Delete Stops</button><br />';
    }

    if (routeStops) {
        html = html + '<br /><button id="addNCStopAsNextStopBtn" onClick="addNonChargeStopAsNextStop(this);">Add Non-Charging Stop as Next Stop</button>';
    }

    if (routeStops && routeStops.length > 0) {
        html = html + '<br /><button id="addNCStopInMiddleBtn" onClick="displayAddNonChargeStopList(this);">Add Non-Charging Stop in Middle</button><br />';
    }

    html = html + '<br /><button id="centerHereBtn" onClick="centerHere(this);">Center Here</button>';
    html = html + '<br />';

    html = html
        + '</form></td><tr>'
        + '</table></div>';

    return html;
}

function addNonChargeStopAsNextStop(thisBtn) {

    var loc = { lat: rightClickLat, lng: rightClickLng };
    var LatLng = new google.maps.LatLng(rightClickLat, rightClickLng);

    myRoute.addNonChargeStopToEnd(loc);

    // Recalc route with new waypoints
    routeWaypoints = myRoute.getAllStopLatlngs();
    directionsDisplay.setOptions({ preserveViewport: false });

    rebuildRoute();
}

function addNonChargeStopAfterStart(thisBtn) {

    var loc = { lat: rightClickLat, lng: rightClickLng };
    var LatLng = new google.maps.LatLng(rightClickLat, rightClickLng);

    myRoute.addNonChargeStopToBeginning(loc);

    // Recalc route with new waypoints
    routeWaypoints = myRoute.getAllStopLatlngs();
    directionsDisplay.setOptions({ preserveViewport: false });

    rebuildRoute();
}

function addNonChargeStopInMiddle(thisBtn) {

    var loc = { lat: rightClickLat, lng: rightClickLng };
    var LatLng = new google.maps.LatLng(rightClickLat, rightClickLng);

    var afterStopIdx = thisBtn.id;

    myRoute.addNonChargeStopToMiddle(loc, afterStopIdx);

    // Recalc route with new waypoints
    routeWaypoints = myRoute.getAllStopLatlngs();
    directionsDisplay.setOptions({ preserveViewport: false });

    rebuildRoute();
}


function centerHere(thisBtn) {

    circleLatLng = { lat: rightClickLat, lng: rightClickLng };

    var LatLng = new google.maps.LatLng(rightClickLat, rightClickLng);

    if (thisMode != appMode.NOROUTE)
        rebuildRoute();

    closeRightClickBox();
}

function getPageElements() {

    mapDiv = document.getElementById('map1');
    mapDirections = document.getElementById('directionsPanel');

    // Get entered Values
    enteredChargerLevel = document.querySelector('input[name="chargerLevel"]:checked').value;
    enteredFrom = routeForm.from.value;
    enteredTo = routeForm.to.value;
    enteredRange = routeForm.range.value;
    enteredPercRange = routeForm.percRange.value;

    checkIfChanged();
}

function checkIfChanged() {

    if (enteredTo != currentTo) {
        updateCurrentValues();
        return;
    }

    if (enteredFrom != currentFrom) {
        updateCurrentValues();
        circleLatLng = null;
        return;
    }

    if (enteredChargerLevel != currentChargerLevel || enteredConnectors != currentConnectors) {
        updateCurrentValues();
        return;
    }

    if (enteredRange != currentRange || enteredPercRange != currentPercRange) {
        updateCurrentValues();
        return;
    }
}

function updateCurrentValues() {
    currentTo = enteredTo;
    currentFrom = enteredFrom;
    currentChargerLevel = enteredChargerLevel;
    currentConnectors = enteredConnectors;
    currentRange = enteredRange;
    currentPercRange = enteredPercRange;
}

function processForm(thisBtnID) {
    switch (thisBtnID) {
        case 'getRouteDirections':
            getRouteDirections();
            break;
        case 'fineTune':
            fineTune();
            break;
        case 'resetRoute':
            resetRoute();
            break;
        case 'showOptions':
            showOptions();
            break;
    }
}

function fineTune() {

    thisMode = appMode.FINETUNE;

    clearMap();

    setDirections(currentFrom, currentTo, locale, function (directionsCallResult) {

        directionsDisplay.setOptions(rendererOptionsDraggable);
        directionsDisplay.setDirections(directionsCallResult);

        setStartMarker(fromLatLng);
        setEndMarker(toLatLng);
        setStopMarkers();

        setElevationChart(directionsCallResult.routes[0].overview_path);

    });
}

function setElevationChart(myPath) {

    elevationService.getElevationAlongPath({
        path: myPath,
        samples: SAMPLES
    }, plotElevation);
}

// Remove the green rollover marker when the mouse leaves the chart
function clearMouseMarker() {
    if (mousemarker != null) {
        mousemarker.setMap(null);
        mousemarker = null;
    }
}

// Takes an array of ElevationResult objects, draws the path on the map
// and plots the elevation profile on a GViz ColumnChart
function plotElevation(results, status) {
    if (status == google.maps.ElevationStatus.OK) {

        elevations = results;

        var path = [];
        for (var i = 0; i < results.length; i++) {
            path.push(elevations[i].location);
        }

        var data = new google.visualization.DataTable();
        data.addColumn('string', 'Sample');
        data.addColumn('number', 'Elevation');
        for (var i = 0; i < results.length; i++) {
            data.addRow(['', elevations[i].elevation]);
        }

        chartData = data;

        document.getElementById('chart_div').style.display = 'block';
        drawChart();
    }
}

function drawChart() {
    chart.draw(chartData, {
            legend: 'none',
            titleY: 'Elevation (m)',
            titleX: 'Click on chart to see spot elevation',
            focusBorderColor: '#00ff00'
        });
}

function getRouteDirections() {
    showSpinner();

    thisMode = appMode.GETDIRECTIONS;
    getPageElements();

    // setDirections from Google
    setDirections(currentFrom, currentTo, locale, function (directionsCallResult) {

        // Get the from and to latlng because the route is requested with names
        fromLatLng = new google.maps.LatLng(directionsCallResult.routes[0].legs[0].start_location.lat(), directionsCallResult.routes[0].legs[0].start_location.lng());
        myRoute.setStart(fromLatLng);

        toLatLng = new google.maps.LatLng(directionsCallResult.routes[0].legs[directionsCallResult.routes[0].legs.length - 1].end_location.lat(), directionsCallResult.routes[0].legs[[directionsCallResult.routes[0].legs.length - 1]].end_location.lng());
        myRoute.setEnd(toLatLng);

        // First clear map of markers and circle
        clearMap();

        directionsDisplay.setOptions(rendererOptionsNonDraggable);
        directionsDisplay.setDirections(directionsCallResult);

        if (!circleLatLng) {
            circleLatLng = { lat: fromLatLng.lat(), lng: fromLatLng.lng() };
        }

        myOCMoptions = {
            center: circleLatLng
            , range: enteredRange
            , verbose: true
        }

        // if plugs are selected then restrict call for just those plugs
        if (plugs)
            myOCMoptions.ConnectionTypeID = plugs.join(',');


        if (!myOCM) myOCM = new OCM();
        myOCM.loadStations(myOCMoptions);

        // get Stations from OCM for level
        selectedLevel = setSelectLevel();
        var StationsByLevel = myOCM.getStationsByLevel(selectedLevel);

        // load returned charging stations to map
        loadOCMStationsToMap(StationsByLevel);

        closeAllInfoBoxes();

        setStartMarker(fromLatLng);
        setEndMarker(toLatLng);
        setStopMarkers();

        setRangeCircles(circleLatLng);

        computeTotalDistance(directionsCallResult);
        computeTotalTimekWh(directionsCallResult);

        setElevationChart(directionsCallResult.routes[0].overview_path);

        hideSpinner();
    });
}

function changeRange(event) {
    if (thisMode != appMode.NOROUTE) {
        if ((event.type == 'keypress' && event.keyCode == 13)
        || event.type == 'change') {
            rebuildRoute();
        }
    }
}

function changeStartingSOCPerc(event) {
    if (thisMode != appMode.NOROUTE) {
        if ((event.type == 'keypress' && event.keyCode == 13)
        || event.type == 'change') {
            startingSOCPerc = $('#startingSOCPerc').val();
            computeTotalTimekWh(directionsDisplay.directions);
        }
    }

}

function changePercRange(event) {
    if (thisMode != appMode.NOROUTE) {
        if ((event.type == 'keypress' && event.keyCode == 13)
        || event.type == 'change') {
            getPageElements();
            clearRangeCircles();
            setRangeCircles(circleLatLng);
        }
    }
}

function rebuildRoute() {
    var oldfrom = currentFrom;
    var oldTo = currentTo;

    getPageElements();

    getRouteDirections();

    RebuildMarkers();
}

function clearMap() {
    clearMapMarkers();
    clearRangeCircles();
}

function RebuildMarkers() {
    closeAllInfoBoxes();

    setSelectLevel();

    // get Stations from OCM
    var StationsByLevel = myOCM.getStationsByLevel(selectedLevel);

    // load returned charging stations to map
    loadOCMStationsToMap(StationsByLevel);

    // Add Start, End and Stop Markers
    setStartMarker(fromLatLng);
    setEndMarker(toLatLng);
    setStopMarkers();
}

function clearMapMarkers() {

    $.each(markersArray, function (i, val) {
        markersArray[i].setMap(null);
    });
    markersArray.length = 0;

    $.each(stopMarkers, function (i, val) {
        stopMarkers[i].setMap(null);
    });
    stopMarkers.length = 0;

    if (startMarker) {
        startMarker.setMap(null);
        startMarker = null;
    }

    if (endMarker) {
        endMarker.setMap(null);
        endMarker = null;
    }
}

function clearRangeCircles() {
    clear100RangeCircle();
    clearPercRangeCircle();
}

function clear100RangeCircle() {
    if (!rangeCircle) return;

    rangeCircle.setMap(null);
    rangeCircle = null;
}

function clearPercRangeCircle() {
    if (!percRangeCircle) return;

    percRangeCircle.setMap(null);
    percRangeCircle = null;
}

function setRangeCircles(centreLatLng) {
    clearRangeCircles();
    setPercRangeCircle(centreLatLng);
    set100RangeCircle(centreLatLng);
}

function set100RangeCircle(centreLatLng) {
    // Add circle overlay and bind to marker
    var circleOptions = {
        map: map,
        center: centreLatLng,
        radius: enteredRange * 1609,    // range in metres
        fillOpacity: 0.1,
        strokeWeight: 2,
        fillColor: '#FFEEEE'
    };

    rangeCircle = new google.maps.Circle(circleOptions);

    google.maps.event.addListener(rangeCircle, 'click', function (event) {
        closeRightClickBox();
        closeOpenInfoBox();
    });

    google.maps.event.addListener(rangeCircle, 'rightclick', function (event) {
        closeAllInfoBoxes();
        showRightClickBox(event);
    });
}

function setPercRangeCircle(centreLatLng) {
    var percRangeCircleOptions = {
        map: map,
        center: centreLatLng,
        radius: (currentPercRange / 100) * enteredRange * 1609,    // range in metres
        fillOpacity: 0.1,
        strokeWeight: 1,
        fillColor: '#FFEEEE'
    };

    percRangeCircle = new google.maps.Circle(percRangeCircleOptions);

    google.maps.event.addListener(percRangeCircle, 'rightclick', function (event) {
        closeAllInfoBoxes();
        showRightClickBox(event);
    });

}

function setDirections(fromAddress, toAddress, locale, callback) {

    directionsService.route(
        {
            origin: fromAddress,
            destination: toAddress,
            waypoints: routeWaypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.IMPERIAL,
            provideRouteAlternatives: false,
            region: locale
        },
        function (result, status) {
            if (status == google.maps.DirectionsStatus.OK) {
                callback(result);
            }
            else
                showAlert('Start or End Locations Cannot Be Found. Please Re-enter');
        }
    );
}

function loadOCMStationsToMap(stations) {

    for (var station in stations) {
        addStationToMap(stations[station]);
    }
}

function addStationToMap(thisStation) {

    var stationInfo;
    var thisContent;
    var thisInfoBox;
    var stationMembershipRequired;
    var iconBase = 'https://maps.google.com/mapfiles/kml/shapes/';
    var stationLat = thisStation.AddressInfo.Latitude;
    var stationLng = thisStation.AddressInfo.Longitude;
    var stationTitle = thisStation.AddressInfo.Title;
    var stationOCMid = thisStation.ID;
    var thisLatlng = { lat: thisStation.AddressInfo.Latitude, lng: thisStation.AddressInfo.Longitude }
    var submissionStatus = thisStation.SubmissionStatus.IsLive;
    var stationOperator;

    stationOperator = 'unknown';
    if (thisStation.OperatorInfo) stationOperator = thisStation.OperatorInfo.Title;

    stationMembershipRequired = 'unknown'
    if (thisStation.UsageType) stationMembershipRequired = thisStation.UsageType.IsMembershipRequired;

    stationInfo = buildStationInfoTable(thisStation);

    myIcon = setMarkerIcon(thisStation);

    marker = new google.maps.Marker({
        position: { lat: stationLat, lng: stationLng },
        map: map,
        optimized: false,
        icon: myIcon
    });

    markersArray.push(marker);
    markersIDArray.push(String(stationOCMid))

    // Create Info Box
    thisContent = stationInfo;

    thisInfoBox = new InfoBox({
        content: thisContent
        , boxStyle: {
            background: 'white'
            , border: '1px solid black'
        }
        , pixelOffset: new google.maps.Size(-20, -30)

    });

    // Display  info window when the marker clicked
    google.maps.event.addListener(marker, 'click', function () {
        closeAllInfoBoxes();
        openInfoBox = thisInfoBox;
        openInfoBox.open(map, this);
    });

    markerInfoBoxArray.push(thisInfoBox);
}

function setMarkerIcon(station) {

    var icon = iconUnknown;

    for (var connection = 0 ; connection < station.Connections.length; connection++) {
        switch (station.Connections[connection].LevelID) {
            case 1:
                if (currentChargerLevel == 'slow') icon = iconSlow;
                break;
            case 2:
                if (currentChargerLevel == 'fast') icon = iconFast;
                break;
            case 3:
                if (currentChargerLevel == 'rapid') icon = iconRapid;
                break;
            default:
                return iconUnknown;
                break;
        }
    }
    return icon;
}

function closeAllInfoBoxes() {
    closeRightClickBox();
    closeOpenInfoBox();
    closeStopListInfoBox();
}

function closeRightClickBox() {
    if (openRightClickBox) {
        openRightClickBox.close();
    }
}

function closeOpenInfoBox() {
    if (openInfoBox) {
        openInfoBox.close();
    }
}

function closeStopListInfoBox() {
    if (openStopListInfoBox) {
        openStopListInfoBox.close();
    }
}

function buildStationInfoTable(thisStation) {
    var mr = 'unknown at this time!';
    if (thisStation.UsageType) { mr = 'Yes'; } else { mr = 'No'; }
    var operator = 'unknown at this time!';
    if (thisStation.OperatorInfo) { operator = thisStation.OperatorInfo.Title }
    var level;

    var html = '<div><u><center><h3>' + thisStation.AddressInfo.Title + '</h3></center></u>'
        + '<table>'
        + '<tr><td>OCM ID:</td><td>' + thisStation.ID + '</td></tr>'
        + '<tr><td>Operator:</td><td>' + operator + '</td></tr>'
        + '<tr><td>Membership?</td><td>' + mr + '</td></tr>'
        + '<tr><td valign="top" align="center"colspan="2"><u>Connections:</u></td><tr>'
        + '<tr><td valign="top" colspan="2">'
        + '<table class="tg"><tr><th>Connector</th><th>Power</th></tr>';

    for (var i = 0; i < thisStation.Connections.length; i++) {
        level = 'unknown';
        if (thisStation.Connections[i].Level) level = thisStation.Connections[i].Level.Title;

        html = html + '<tr>'
            + '<td>' + thisStation.Connections[i].ConnectionType.Title + '</td>'
            + '<td>' + level + '</td>'
            + '</tr>';
    }

    var addAsNextStopID = 'addAsNextStop' + thisStation.ID;
    var addInMiddleID = 'addInMiddle' + thisStation.ID;
    var infoID = 'info' + thisStation.ID;
    var centreID = 'centre' + thisStation.ID;
    var zoomInID = 'zoomIn' + thisStation.ID;
    var zoomOutID = 'zoomOut' + thisStation.ID;


    html = html
        + '</table>'
        + '</td></tr>'
        + '<tr><td colspan="2"><form id="addForm">'
        + '<input type = "button" id="' + centreID + '" onClick="centreStation(this);" value="Centre Station"></input>'
        + '<br /><br />'
        + '<input type = "button" id="' + addAsNextStopID + '" onClick="addAsNextChargingStop(this);" value="Add as Next Charging Stop"></input>'
        + '<input type = "button" id="' + addInMiddleID + '" onClick="displayAddChargeStopList(this);" value="Add Charging Stop in Middle"></input>'
        + '<br /><br />'
        + '<input type = "button" id="' + zoomInID + '" onClick="zoomIn(this);" value="Zoom In"></input>'
        + '<input type = "button" id="' + zoomOutID + '" onClick="zoomOut(this);" value="Zoom Out"></input>'
        + '<br /><br />'
        + '<input type="button" id="' + infoID + '" onClick="displayFullStationInfo(this);" value="Full Info"></input>'
        + '</td></tr></table>'
        + '</div>';

    return html;
}

function zoomIn(thisBtn) {

    var thisID = getStationIDfromBtn(thisBtn.id);
    var thisStation = myOCM.getStationByID(thisID);
    var thisLatlng = { lat: thisStation.AddressInfo.Latitude, lng: thisStation.AddressInfo.Longitude }

    circleLatLng = thisLatlng;

    directionsDisplay.setOptions({ preserveViewport: true });
    map.setCenter(circleLatLng);
    map.setZoom(16);

    rebuildRoute();
}

function zoomOut(thisBtn) {

    var thisID = getStationIDfromBtn(thisBtn.id);
    var thisStation = myOCM.getStationByID(thisID);
    var thisLatlng = { lat: thisStation.AddressInfo.Latitude, lng: thisStation.AddressInfo.Longitude }

    circleLatLng = thisLatlng;

    directionsDisplay.setOptions({ preserveViewport: false });

    rebuildRoute();
}

function getMarkerForId(id) {
    var i = markersIDArray.indexOf(id);
    if (i != -1) {
        return markersArray[i];
    } else {
        showAlert('Error finding marker array: ID=' + id);
        return -1;
    }
}

function centreStation(thisBtn) {
    var thisID = getStationIDfromBtn(thisBtn.id);
    var thisStation = myOCM.getStationByID(thisID);
    var thisLatlng = { lat: thisStation.AddressInfo.Latitude, lng: thisStation.AddressInfo.Longitude }

    circleLatLng = thisLatlng;
    directionsDisplay.setOptions({ preserveViewport: true });
    map.setCenter(circleLatLng);

    rebuildRoute();

}

function displayFullStationInfo(thisBtn) {
    var thisID = getStationIDfromBtn(thisBtn.id);
    var infoURL = infoBaseURL + thisID;

    infoWindow = window.open('', 'stationInfoWindow', 'width=800, height=600, resizable=yes, scrollbars=yes');
    infoWindow.location = infoURL;
    infoWindow.focus();
}

function showOptions() {

    optionsWindow = window.open('options.html', 'optionsWindow', 'width=800, height=600, resizable=yes, scrollbars=yes');
    optionsWindow.focus();
}

function updateOptions() {

    getStoredOptions();

    var $select = $('#optionsDiv');
    $select.html('');
    $select.append(
        'Active Options - Car: '
        + Cars[model].car
        + ''
        );

      $('#plugs').val(plugs);

    //$('#car').val(model);
    //$('#distanceUnits').val(distanceUnits);
    //$('#powerUse').val(powerUse);
    //$('#powerUnits').val(powerUnits);
    //$('#fastestShortest').val(fastestShortest);
    //$('#SOCatEndofLeg').val(SOCatEndofLeg);
    //$('#SOCatEndofCharge').val(SOCatEndofCharge);
    //$('#minStopTime').val(minStopTime);
    //$('#preferredNetworks').val(preferredNetworks);

    $('input[name="chargerLevel"]').val([preferredLevel]);
    $('#range').val(range);

    if (thisMode != appMode.NOROUTE) rebuildRoute();
}

function addAsNextChargingStop(thisBtn) {

    var thisID;
    thisID = getStationIDfromBtn(thisBtn.id);

    var marker = getMarkerForId(thisID);
    if (marker == -1) return -1;

    myRoute.addChargeStopToEnd(thisID, marker, myOCM);            // Remove and replace with new selection 

    // reload OCM data from new center
    circleLatLng = myOCM.getStationLatlng(thisID);
    myOCMoptions.center = circleLatLng;
    myOCM.loadStations(myOCMoptions);

    // Recalc route with new waypoints
    routeWaypoints = myRoute.getAllStopLatlngs();
    directionsDisplay.setOptions({ preserveViewport: false });

    rebuildRoute();
}

function addChargeStopAfterStart(thisBtn) {
    var afterStopId, afterStopIdx, marker;
    marker = getMarkerForId(addingID);

    if (marker == -1) showAlert('Marker Not Found for station : ' + addingID);

    myRoute.addChargeStopToBeginning(addingID, marker, myOCM);

    // reload OCM data from new center
    circleLatLng = myOCM.getStationLatlng(addingID);
    myOCMoptions.center = circleLatLng;
    myOCM.loadStations(myOCMoptions);

    // Recalc route with new waypoints
    routeWaypoints = myRoute.getAllStopLatlngs();
    directionsDisplay.setOptions({ preserveViewport: false });

    rebuildRoute();
}

function AddChargeStopInMiddle(thisBtn) {
    var afterStopId, afterStopIdx, marker, stops;

    afterStopIdx = thisBtn.id;
    stops = myRoute.getAllStops();
    afterStopID = stops[afterStopIdx].Station.ID;
    marker = getMarkerForId(addingID);

    if (marker == -1) showAlert('Marker Not Found for station : ' + addingID);

    myRoute.addChargeStopToMiddle(addingID, marker, myOCM, afterStopIdx);

    // reload OCM data from new center
    circleLatLng = myOCM.getStationLatlng(addingID);
    myOCMoptions.center = circleLatLng;
    myOCM.loadStations(myOCMoptions);

    // Recalc route with new waypoints
    routeWaypoints = myRoute.getAllStopLatlngs();
    directionsDisplay.setOptions({ preserveViewport: false });
    rebuildRoute();
}
function deleteStop(thisBtn) {

    var deleteIdx = thisBtn.id;

    myRoute.deleteStop(deleteIdx);

    //Recalc route with new waypoints
    routeWaypoints = myRoute.getAllStopLatlngs();

    if (deleteIdx == 0) {
        circleLatLng = { lat: fromLatLng.lat(), lng: fromLatLng.lng() };
    } else {
        circleLatLng = { lat: routeStops[deleteIdx - 1].position.lat, lng: routeStops[deleteIdx - 1].position.lng };
    }

    directionsDisplay.setOptions({ preserveViewport: false });

    rebuildRoute();
}

function displayAddChargeStopList(thisBtn) {

    var stops, thisID, station, i, html, stopListInfoBox;

    closeAllInfoBoxes();

    thisID = getStationIDfromBtn(thisBtn.id);
    addingID = thisID;

    stops = myRoute.getAllStops();

    var html = '<div><u><center><h3>Stops on Route</h3></center></u>'
    + '<input type="button" id="0" onClick="addChargeStopAfterStart(this);" value="Add After Start"></input><br /><br />'
    + '<table id="stopsTable">'
    + '<tr>'
    + '<th> </th>'
    + '<th>OCM Id</th>'
    + '<th>Location</th>'
    + '<th>Stop Type</th>'
    + '<th>Action</th>';

    for (i = 0; i < stops.length; i++) {

        stop = stops[i];
        station = stop.Station;

        switch (stop.type) {
            case StopType.CHARGING:
                stopType = 'Charging';
                stationID = station.ID;
                stationTitle = '<a href="' + infoBaseURL + station.ID + '" target="_blank">' + station.AddressInfo.Title + '</a>';
                break;

            case StopType.NONCHARGING:
                stopType = 'Non-Charging';
                stationID = '';
                stationTitle = stop.stationTitle;
                break;
        }

        html = html + '<tr>'
            + '<td><img src="' + setStopMarkerType(stop.type, i) + '" /></td>'
            + '<td>' + stationID + '</td>'
            + '<td>' + stationTitle + '</td>'
            + '<td>' + stopType + '</td>'
            + '<td><input type="button" id="' + i + '" onClick="AddChargeStopInMiddle(this);" value="Add After This Stop"></input></td>';
    }

    html = html
        + '</table>'
        + '</div>';

    stopListInfoBox = new InfoBox({
        content: html
        , boxStyle: {
            background: 'white'
            , border: '1px solid black'
        }
		, position: map.getCenter()
        , pane: 'overlayMouseTarget'
    });

    stopListInfoBox.open(map);
    openStopListInfoBox = stopListInfoBox;

}

function displayAddNonChargeStopList(thisBtn) {

    var stops, thisID, i, html, stopListInfoBox;

    closeAllInfoBoxes();

    stops = myRoute.getAllStops();

    var html = '<div><u><center><h3>Stops on Route</h3></center></u>'
    + '<input type="button" id="0" onClick="addNonChargeStopAfterStart(this);" value="Add After Start"></input><br /><br />'
    + '<table id="stopsTable">'
    + '<tr>'
    + '<th> </th>'
    + '<th>OCM Id</th>'
    + '<th>Location</th>'
    + '<th>Stop Type</th>'
    + '<th>Action</th>';

    for (i = 0; i < stops.length; i++) {

        stop = stops[i];
        station = stop.Station;

        switch (stop.type) {
            case StopType.CHARGING:
                stopType = 'Charging';
                stationID = station.ID;
                stationTitle = '<a href="' + infoBaseURL + station.ID + '" target="_blank">' + station.AddressInfo.Title + '</a>';
                break;

            case StopType.NONCHARGING:
                stopType = 'Non-Charging';
                stationID = '';
                stationTitle = stop.stationTitle;
                break;
        }

        html = html + '<tr>'
            + '<td><img src="' + setStopMarkerType(stop.type, i) + '" /></td>'
            + '<td>' + stationID + '</td>'
            + '<td>' + stationTitle + '</td>'
            + '<td>' + stopType + '</td>'
            + '<td><input type="button" id="' + i + '" onClick="addNonChargeStopInMiddle(this);" value="Add After This Stop"></input></td>';
    }

    html = html
        + '</table>'
        + '</div>';

    stopListInfoBox = new InfoBox({
        content: html
        , boxStyle: {
            background: 'white'
            , border: '1px solid black'
        }
		, position: map.getCenter()
        , pane: 'overlayMouseTarget'
    });

    stopListInfoBox.open(map);
    openStopListInfoBox = stopListInfoBox;

}

function displayDeleteStopList(thisBtn) {

    var station, stops, stop, stopType, stationID, stationTitle;

    closeAllInfoBoxes();

    stops = myRoute.getAllStops();

    if (!stops) {
        showAlert('** No Stops Planned Yet **');
        return;
    }

    var html = '<div><u><center><h3>Stops on Route</h3></center></u>'
    + '<table id="stopsTable">'
    + '<tr>'
    + '<th> </th>'
    + '<th>OCM Id</th>'
    + '<th>Location</th>'
    + '<th>Stop Type</th>'
    + '<th>Action</th>';

    for (var i = 0; i < stops.length; i++) {

        stop = stops[i];
        station = stop.Station;

        switch (stop.type) {
            case StopType.CHARGING:
                stopType = 'Charging';
                stationID = station.ID;
                stationTitle = '<a href="' + infoBaseURL + station.ID + '" target="_blank">' + station.AddressInfo.Title + '</a>';
                break;

            case StopType.NONCHARGING:
                stopType = 'Non-Charging';
                stationID = '';
                stationTitle = stop.stationTitle;
                break;
        }

        html = html + '<tr>'
            + '<td><img src="' + setStopMarkerType(stop.type, i) + '" /></td>'
            + '<td>' + stationID + '</td>'
            + '<td>' + stationTitle + '</td>'
            + '<td>' + stopType + '</td>'
            + '<td><input type="button" id="' + i + '" onClick="deleteStop(this);" value="Delete Stop"></input></td>';
    }

    html = html
        + '</table>'
        + '</div>';

    var stopListInfoBox = new InfoBox({
        content: html
        , boxStyle: {
            background: 'white'
            , border: '1px solid black'
        }
		, position: map.getCenter()
        , pane: 'overlayMouseTarget'
    });

    stopListInfoBox.open(map);
    openStopListInfoBox = stopListInfoBox;

}

function onGDirectionsLoad() {
    var poly = gdir.getPolyline();
    if (poly.getVertexCount() > 100) {
        showAlert('This route has too many vertices');
        return;
    }
    var baseUrl = 'http://maps.google.com/staticmap?';

    var params = [];
    var markersArray = [];
    markersArray.push(poly.getVertex(0).toUrlValue(5) + ',greena');
    markersArray.push(poly.getVertex(poly.getVertexCount() - 1).toUrlValue(5) + ',greenb');
    params.push('markers=' + markersArray.join('|'));

    var polyParams = 'rgba:0x0000FF80,weight:5|';
    var polyLatLngs = [];
    for (var j = 0; j < poly.getVertexCount() ; j++) {
        polyLatLngs.push(poly.getVertex(j).lat().toFixed(5) + ',' + poly.getVertex(j).lng().toFixed(5));
    }
    params.push('path=' + polyParams + polyLatLngs.join('|'));
    params.push('size=300x300');
    params.push('key=ABQIAAAAjU0EJWnWPMv7oQ-jjS7dYxSPW5CJgpdgO_s4yyMovOaVh_KvvhSfpvagV18eOyDWu7VytS6Bi1CWxw');

    baseUrl += params.join('&');

    // Add start pin
    //var extraParams = [];
    //extraParams.push('center=' + poly.getVertex(0).toUrlValue(5));
    //extraParams.push('zoom=' + 15);
    //addImg(baseUrl + '&' + extraParams.join('&'), 'staticMapStartIMG');

    // Add end pin
    //var extraParams = [];
    //extraParams.push('center=' + poly.getVertex(poly.getVertexCount() - 1).toUrlValue(5));
    //extraParams.push('zoom=' + 15);
    //addImg(baseUrl + '&' + extraParams.join('&'), 'staticMapEndIMG');
}

function getStationIDfromBtn(thisBtnID) {
    return thisBtnID.replace(/\D/g, '');
}

function addImg(url, id) {
    var img = document.createElement('img');
    img.src = url;
    document.getElementById(id).innerHTML = '';
    document.getElementById(id).appendChild(img);
}

function getLatLngFromAddress(address, callback) {
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 'address': address }, function (results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var latitude = results[0]['geometry']['location'].lat();
            var longitude = results[0]['geometry']['location'].lng();
            var ll = results[0].geometry.location;
            callback(ll);
        } else {
            showAlert('Geocode Request Failed.')
        }
    });
};

function getFormattedAddressFromLatLng(latlng, callback) {
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 'latLng': latlng }, function (results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var formatted_address = results[0].formatted_address;
            callback(formatted_address);
        } else {
            callback('Address Not Found')
        }
    });
};

function resetRoute() {
    showSpinner();

    thisMode = appMode.RESET;

    clearMapMarkers();
    clearRangeCircles();
    clearStops();
    closeAllInfoBoxes();

    directionsDisplay.setMap(null);

    directionsDisplay = new google.maps.DirectionsRenderer(rendererOptionsNonDraggable);
    directionsDisplay.setMap(map);

    if (fromLatLng) {
        circleLatLng = { lat: fromLatLng.lat(), lng: fromLatLng.lng() };
    }

    $('#directionsDiv').hide();
    $('#chart_div').hide();

    setUpListeners();

    hideSpinner();
}

function computeTotalDistance(directionsResult) {
    var totalDistance = 0;
    var totalDuration = 0;

    var legs = directionsResult.routes[routeIndex].legs;

    for (var i = 0; i < legs.length; ++i) {
        totalDistance += legs[i].distance.value;
    }

    totalDistance = Math.round(totalDistance * METERS_TO_MILES * 10) / 10;

    var totalDistanceHtml = '<hr /><b>Distance: </b>' + totalDistance + ' miles<hr />';

    $('#totalDistance').html(totalDistanceHtml);

    $('#directionsDiv').show();

    //setTextDirections(directionsResult);

    hideSpinner();
}

function computeTotalTimekWh(directionsResult) {
    var totalDuration = 0;
    var totalTravelTime = 0;
    var totalChargingTime = 0;
    var totalJourneyTime = 0;
    var totalChargekWh = 0;
    var totalChargingTimeSeconds = 0;
    var legs = directionsResult.routes[routeIndex].legs;

    routeStops = myRoute.getAllStops();

    // zip thru legs totalling up time and kWh
    for (var legIndex = 0; legIndex < legs.length; ++legIndex) {
        totalDuration += legs[legIndex].duration.value;
        totalChargekWh += getPowerNeededAtStop(legIndex, legs, routeStops);
    }

    var numStops = routeStops.length;

    totalTravelTime = moment().startOf('day')
        .seconds(totalDuration)
        .format('H:mm');

    totalChargingTimeSeconds = numStops * (minStopTime * 60)
    totalChargingTime = moment().startOf('day')
        .seconds(totalChargingTimeSeconds)
        .format('H:mm');

    totalJourneyTime = totalDuration + totalChargingTimeSeconds;
    totalJourneyTime = moment().startOf('day')
        .seconds(totalJourneyTime)
        .format('H:mm');

    var totalTravelTimeHtml = '<b>Travel Time: </b>' + totalTravelTime + '<br />';
    var totalChargingTimeHtml = '<b>Charging Time Estimate: </b>' + totalChargingTime + ' (' + numStops + ' x ' + minStopTime + 'min stops)<br />';
    var totalJourneyTimeHtml = '<b>Total Journey Time: </b>' + totalJourneyTime + '<br /><hr />';
    var totalChargekWhHtml = '<b>Total Charge kWh: </b>' + totalChargekWh.toFixed(2) + ' kWh<br /><hr />';

    $('#totalTravelTime').html(totalTravelTimeHtml);
    $('#totalChargingTime').html(totalChargingTimeHtml);
    $('#totalJourneyTime').html(totalJourneyTimeHtml);
    $('#totalChargingKwh').html(totalChargekWhHtml);

    $('#directionsDiv').show();

    setTextDirections(directionsResult);

    hideSpinner();
}

function getPowerNeededAtStop(legIndex, legs, Stops) {

    var legDistanceMeters = legs[legIndex].distance.value;
    var legDistanceMiles = Math.round(legDistanceMeters * METERS_TO_MILES * 10) / 10;
    var kWhNeeded = legDistanceMiles / powerUse;

    if (legIndex > 0) {
        Stops[legIndex - 1].updateChargeRequiredkWh(kWhNeeded);
    }

    return kWhNeeded;

}

function showDetailedDirections() {

    if ($('#showDirectionDetailsCb').is(':checked')) {
        $('.dir_row').removeClass('dir_row_hidden');
        DetailedDirectionsVisible = true;
    } else {
        $('.dir_row').addClass('dir_row_hidden');
        DetailedDirectionsVisible = false;
    }
}

function showPowerDetails() {

    if ($('#showPowerDetailsCb').is(':checked')) {
        $('.estimate').removeClass('estimate_hidden');
        PowerDetailsVisible = true;
    } else {
        $('.estimate').addClass('estimate_hidden');
        PowerDetailsVisible = false;

    }
}

function setTextDirections(directionsResult) {
    var dirpanel = document.getElementById('directions');
    var route = directionsResult.routes[0];
    var legs = route.legs;
    var usablekWh = currentRange / powerUse;
    var minKWhatEndofLeg = (SOCatEndofLeg / 100) * usablekWh;
    var minkWhatEndofCharge = (SOCatEndofCharge / 100) * usablekWh;
    var EOLPerc, SOLPerc, EOLkWh, SOLkWh;


    routeStops = myRoute.getAllStops();

    var output = '<table id="directionsTable">';

    // Output calculated estimates
    output += '<tr><td><div class="dir_summary"><center><u>Calculated Estimates</u></center><br />';
    output += 'Usable 100% kWh: ' + usablekWh.toFixed(2) + '<br />';
    output += 'Min kWh at end of legs: ' + minKWhatEndofLeg.toFixed(2) + '<br />';
    output += 'Min kWh at start of legs: ' + minkWhatEndofCharge.toFixed(2) + '<br />';
    output += '<hr /></div></td></tr>';

    //  checkboxes
    var DDV = '';
    if (DetailedDirectionsVisible) { DDV = 'checked="checked"' }

    var PDV = '';
    if (PowerDetailsVisible) { PDV = 'checked="checked"' }

    output += '<form>Show Detailed Directions:<input type="checkbox" id="showDirectionDetailsCb" onclick="showDetailedDirections();"' + DDV + ' /><br />';
    output += 'Show Power Details:<input type="checkbox" id="showPowerDetailsCb" onclick="showPowerDetails();" ' + PDV + '/></form>';

    // output the Start Point
    output += '<tr><td><div class="dir_start"><img src="graphics/home1.png" />' + legs[0].start_address + '</div></td></tr>';

    // process each leg in the route
    for (var legIndex = 0; legIndex < route.legs.length; legIndex++) {
        buildLegDetails();
    }

    output += '<tr><td><div class="dir_end"><img src="graphics/home2.png" />' + legs[legs.length - 1].end_address + '</div></td></tr>';
    output += '</table>'

    dirpanel.innerHTML = output;

    showDetailedDirections();
    showPowerDetails();

    // ******************************************************************************
    // * Internal functions to setTextDirections
    // ******************************************************************************

    function buildLegDetails() {
        var stopIdx = legIndex - 1;

        // if not the first leg then there must be a stop after it
        if (legIndex != 0) {
            output += '<tr><td><img style="float: left; padding-right: 5px;" src="'
                + setStopMarkerType(routeStops[stopIdx].type, stopIdx) + '" />';

            if (routeStops[stopIdx].type == StopType.CHARGING) {
                output += '<a href="' + infoBaseURL + routeStops[stopIdx].id + '" target="_blank">' + routeStops[stopIdx].stationTitle + '</a><br />';
                output += legs[legIndex].start_address + '</td>';

            } else {
                if (routeStops[stopIdx].stationTitle) {
                    output += routeStops[stopIdx].stationTitle + '</td>';
                } else {
                    output += 'Address Not Found</td>';
                }

            }
        }

        output += '<tr><td>';
        output += '<div class="dir_summary">Leg Distance: ' + legs[legIndex].distance.text + ' - about ' + legs[legIndex].duration.text;


       if (legIndex == 0) {
            SOLPerc = startingSOCPerc;
            SOLkWh = usablekWh;
        } else {
            if (routeStops[stopIdx].type == StopType.CHARGING) {
                SOLPerc = SOCatEndofCharge;
                SOLkWh = usablekWh * (SOLPerc /100);
            } else {
                SOLPerc = (kWhRemaining / usablekWh) * 100;
                SOLkWh = kWhRemaining;
            }
        }

        powerNeededkWh = getPowerNeededAtStop(legIndex, legs, routeStops);
        kWhRemaining = SOLkWh - powerNeededkWh;
        output += '<div class="estimate">Start of Leg: ' + SOLkWh.toFixed(2) + ' kWh (' + parseFloat(SOLPerc).toFixed(2) + '%)</div>';

        output += '<div class="estimate">Used on Leg: ' + powerNeededkWh.toFixed(2) + ' kWh</div>';
        output += '<div class="estimate">Remaining at end of Leg: ' + kWhRemaining.toFixed(2) + ' kWh</div>';

        if (kWhRemaining < minKWhatEndofLeg) {
            output += '<div class="warning">Warning: Estimate SOC at end of leg below target of ' + minKWhatEndofLeg.toFixed(2) + ' kWh';
        }

        // add charge to min if a charging stop
        //if (legIndex != 0 && routeStops[stopIdx].type == StopType.CHARGING) {
        //    kWhRemaining = minkWhatEndofCharge;
        //}

        output += '<hr /></td>';

        var leg = route.legs[legIndex];

        // Build turn by turn instructions
        output += '<tr><td><table>';
        for (i = 0; i < leg.steps.length; i++) {
            output += '<tr class="dir_row dir_row_hidden">';

            var maneuver;

            if (leg.steps[i].maneuver == '') { maneuver = 'straight'; }
            else { maneuver = leg.steps[i].maneuver; }

            output += '<td class="dir_td"><span class="dir_sprite ' + maneuver + '"></span></td>';
            output += '<td class="dir_td">' + (i + 1) + '.</td>';
            output += '<td class="dir_td">' + leg.steps[i].instructions + '</td>';
            output += '<td class="dir_td">' + leg.steps[i].distance.text + '</td>';
            output += '</tr>';
        }
        output += '</table></td>';
    }
}


function clearStops() {
    routeStops = null;
    routeWaypoints = null;
    markersArray = [];
    markerInfoBoxArray = [];
    markersIDArray = [];
    circleLatLng = null;

    myRoute.clearStops();
}

function setSelectLevel() {

    // set selected level
    if (enteredChargerLevel == 'fast')
        return '2';

    if (enteredChargerLevel == 'rapid')
        return '3';

    return '1';
}

function handleErrors() {
    if (gdir.getStatus().code == G_GEO_UNKNOWN_ADDRESS)
        showAlert('No corresponding geographic location could be found for one of the specified addresses. This may be due to the fact that the address is relatively new, or it may be incorrect.\nError code: ' + gdir.getStatus().code);
    else if (gdir.getStatus().code == G_GEO_SERVER_ERROR)
        showAlert('A geocoding or directions request could not be successfully processed, yet the exact reason for the failure is not known.\n Error code: ' + gdir.getStatus().code);
    else if (gdir.getStatus().code == G_GEO_MISSING_QUERY)
        showAlert('The HTTP q parameter was either missing or had no value. For geocoder requests, this means that an empty address was specified as input. For directions requests, this means that no query was specified in the input.\n Error code: ' + gdir.getStatus().code);
    else if (gdir.getStatus().code == G_GEO_BAD_KEY)
        showAlert('The given key is either invalid or does not match the domain for which it was given. \n Error code: ' + gdir.getStatus().code);
    else if (gdir.getStatus().code == G_GEO_BAD_REQUEST)
        showAlert('A directions request could not be successfully parsed.\n Error code: ' + gdir.getStatus().code);
    else showAlert('An unknown error occurred.');
}

function showSpinner() {
    $('body').addClass('loading');
}

function hideSpinner() {
    $('body').removeClass('loading');
}

function showAlert(msg) {
    alert(msg);
    hideSpinner();
}

// **************************************************************************************************************



// ********************************************************************************************************




google.maps.event.addDomListener(window, 'load', loadMap);