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

// JavaScript Document

var map;
var mapDiv;
var mapDirections;
var geoXml;
var gdir;


var fromLatLng;

var enteredFrom;
var enteredTo;
var enteredRange;
var enteredFastChargers;
var enteredRapidChargers;

var locale = "en-gb";

var myOCM;

var myOCMoptions;
var OCMRefData;

var OCMIds = [];

var rendererOptions = {
    draggable: true
};

var directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);
var directionsReturn;
var directionsService = new google.maps.DirectionsService();
var mapOrigin = new google.maps.LatLng(52.478379, -1.892986); // Centre initially on Birmingham
var addressLatLng = mapOrigin;
var routeWaypoints = [];
var markersArray = [];
var markerInfoBoxArray = [];
var markersIDArray = [];
var openInfoBox;
var rangeCircle;
var circleLatlng;

var selectedLevel;
var below = false;

var myRoute;

// loadMap()
// Creates initial Map canvas.
// it has no directions and no markers
function loadMap() {

    getOCMRefData();
    getPageElements();

    //Setting starting options of map
    var mapOptions = {
        center: mapOrigin, // Birmingham at start
        zoom: 7,
        mapTypeId: google.maps.MapTypeId.ROADMAP,

        //Add controls
        mapTypeControl: true,
        scaleControl: true,
        overviewMapControl: true,
        overviewMapControlOptions: {
            opened: true
        }
    };

    // Generate map
    map = new google.maps.Map( mapDiv, mapOptions );

    directionsDisplay.setMap(map);
    directionsDisplay.setPanel(mapDirections);

    // close infobox if map clicked
    google.maps.event.addListener(map, "click", function (event) {
        if (openInfoBox) {
            openInfoBox.close();
        }
    });

    // listen for dragged route changes
    google.maps.event.addListener(directionsDisplay, 'directions_changed', function () {
        // store new waypoints in Route
        var newWaypoints = directionsDisplay.directions.route[0].legs[0].via_waypoint;
        myRoute.saveWaypoints(newWaypoints);
    });

    
}

// getPageElements()
// Inspects page htmla nd sets up "entered..." values from the page contents
function getPageElements() {

    mapDiv = document.getElementById('map1');
    mapDirections = document.getElementById("directionsPanel");

    // Get entered Values
    enteredFastChargers = routeForm.cbFastChargers.checked;
    enteredRapidChargers = routeForm.cbRapidChargers.checked;
    enteredFrom = routeForm.from.value;
    enteredTo = routeForm.to.value;
    enteredRange = routeForm.range.value;
}

// getDirections()
// Run when "get Directions" button clicked
//
// - First existing map is cleared of all markers, info boxes and circle as the new route will determine what markers are to be set and where the range circle is set.
// - Directions are obtained from Google and the route plotted on map.
// - resets the OCM object to a new OCM instance
// - sets the OCM Options to be the default options - start is the start of the route and range is the current entered range.
// - Loads the OCM stations
// - Get the stations that are for the current level
// - loads those stations to map as markers.
// - set range circle to be the current entered range
// - create new route
function getDirectionsClick() {

    getPageElements();

    // setDirections from Google
    setDirections(enteredFrom, enteredTo, locale, function (directionsCallResult) {

        // Get the from and to latlng because the route is requested with names
        fromLatLng = { lat: directionsCallResult.routes[0].legs[0].start_location.lat(), lng: directionsCallResult.routes[0].legs[0].start_location.lng() };
        toLatLng = { lat: directionsCallResult.routes[0].legs[0].end_location.lat(), lng: directionsCallResult.routes[0].legs[0].end_location.lng() };


        // First clear map of markers and circle
        clearMap();

        // Display route on map
        directionsDisplay.setDirections(directionsCallResult);

        // Set OCM Options
        // Set Circle
        if (!circleLatlng) {
            circleLatlng = fromLatLng;
        }

        setRangeCircle(circleLatlng);


        myOCMoptions = {
            center: circleLatlng
            , range: enteredRange
            , locale: "en-gb"
        }

        if (!myOCM) myOCM = new OCM();
        myOCM.LoadStations(myOCMoptions);

        // get Stations from OCM for level
        setSelectLevel();
        var StationsByLevel = myOCM.getStationsByLevel(selectedLevel, below);

        // load returned charging stations to map
        loadOCMStationsToMap(StationsByLevel);

        // create new route
        if (!myRoute) myRoute = new Route(fromLatLng, toLatLng, myOCM);

    });

}

// ChargersChanges()
// Run when any of the charger types are changed on the page
//
// - if route has changed then calculate new directions
// - if there is no route set then do nothing and return
// - get the latest entered values from the page
// - clear the map of all markers and infoboxes as we are now reselecting which markers are to be shown
// - set the selected level from the entered values ready to get the selected stations
// - get the stations that are for this level
// - load those stations to the map
function ChargersChanges() {

     // If no route set then do nothing
    if (!myRoute) return;

    // if route changed then recalc directions
    var oldfrom = enteredFrom;
    var oldTo = enteredTo;

    getPageElements();

    if (oldfrom != enteredFrom || oldTo != enteredTo) {
        getDirectionsClick();
        return;
    }

    //Rebuild Markers
    RebuildMarkers();

}

function clearMap() {
    clearMapMarkers();
    clearMapCircles();
}

function RebuildMarkers() {

    clearMapMarkers();

    setSelectLevel();

    // get Stations from OCM
    var StationsByLevel = myOCM.getStationsByLevel(selectedLevel, below);

    // load returned charging stations to map
    loadOCMStationsToMap(StationsByLevel);


}

// clearMapMarkers()
// clear off markers from the map. A list of all markers currently on the map is held in MarkersArray
//
// - Loop through markersArray and remove each marker from map
// - set markersArray to be empty
function clearMapMarkers() {
    for (var i = 0; i < markersArray.length; i++) {
        markersArray[i].setMap(null);
    }
    markersArray.length = 0;

    if (openInfoBox) openInfoBox.close();

}

// clearMapCircle()
// Removes circle from map
function clearMapCircles() {

    // If no range circle then return
    if (!rangeCircle) return;

    rangeCircle.setMap(null);
}

// setRangeCircle(google.maps.LatLng centreLatLng)
// Takes a Google lLatLng and adds a circle to the map centered on that point for the current entered range
function setRangeCircle(centreLatLng) {
    // Add circle overlay and bind to marker
    var circleOptions = {
        map: map,
        center: centreLatLng,
        radius: enteredRange * 1609,    // range in metres
        fillColor: '#FFEEEE'
    };

    var circle = new google.maps.Circle(circleOptions);
    rangeCircle = circle;
    circle.setMap(map);

    google.maps.event.addListener(circle, "click", function (event) {
        if (openInfoBox) {
            openInfoBox.close();
        }
    });

}

// Does directions call to google
function setDirections(fromAddress, toAddress, locale, callback) 
{
    directionsService.route(
        {
            origin: fromAddress,
            destination: toAddress,
            waypoints: routeWaypoints, 
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.IMPERIAL,
            region: locale
        },
        function (result, status) {
            if (status == google.maps.DirectionsStatus.OK) {
                callback(result);
            }
            else
                alert("Error getting route!")
        }
    );

}

// Takes an array of stations and loads each to the map
function loadOCMStationsToMap(stations) {
   
    for (var station in stations) {
        addStationToMap(stations[station]);
    }
}

// Adds a station to map, creates info box and stores the marker in the markerArray and markersIDArray.
// stores infobox in InfoBoxArray.
function addStationToMap(thisStation) {

    // don't add if current center of circle
    var thisLatlng = { lat: thisStation.AddressInfo.Latitude, lng: thisStation.AddressInfo.Longitude }
    if (thisLatlng == circleLatlng) return;

    var iconBase = 'https://maps.google.com/mapfiles/kml/shapes/';
    var stationLat = thisStation.AddressInfo.Latitude;
    var stationLng = thisStation.AddressInfo.Longitude;
    var stationTitle = thisStation.AddressInfo.Title;
    var stationOCMid = thisStation.ID;
    stationOperator = "unknown";
    if (thisStation.OperatorInfo) stationOperator = thisStation.OperatorInfo.Title;
    var stationMembershipRequired = "unknown"
    if (thisStation.UsageType) stationMembershipRequired = thisStation.UsageType.IsMembershipRequired;

    var stationInfo = buildStationInfoTable(thisStation);

    marker = new google.maps.Marker({
        position: { lat: stationLat, lng: stationLng },
        map: map,
        optimized: false
    });

    markersArray.push(marker);
    markersIDArray.push(stationOCMid)

    // Create Info Box
    var thisContent;

    thisContent = stationInfo;

    var thisInfoBox = new InfoBox({
        content: thisContent
        ,boxStyle: {
            background: "white"
            ,border: "1px solid black"
        }
        ,pixelOffset: new google.maps.Size(-20, -30)

    });

    // Display  info window when the marker is clicked
    google.maps.event.addListener(marker, 'click', function () {
        AddToRoute(this);
    });
    google.maps.event.addListener(marker, 'mouseover', function () {
        if (openInfoBox) {
            openInfoBox.close();
        }

        openInfoBox = thisInfoBox;
        openInfoBox.open(map, this);
    });

    markerInfoBoxArray.push(thisInfoBox);
}

function closeAllInfoBoxes() {
    for (var i = 0; i < markerInfoBoxArray.length; i++) {
        markerInfoBoxArray[i].close();
    }
}

// Builds the tooltip info box.
function buildStationInfoTable(thisStation) {
    var mr = "unknown at this time!";
    if (thisStation.UsageType) { mr = "Yes"; } else { mr = "No"; }
    var operator = "unknown at this time!";
    if (thisStation.OperatorInfo) { operator = thisStation.OperatorInfo.Title } 

    var html = '<div><u><h3>' + thisStation.AddressInfo.Title + '</h3></u>'
        + '<table>'
        + '<tr><td>OCM ID:  </td><td>' + thisStation.ID + '</td></tr>'
        + '<tr><td>Operator:  </td><td>' + operator + '</td></tr>'
        + '<tr><td>Membership?  </td><td>' + mr + '</td></tr>'
        + '<tr><td colspan="2"><form id="addForm"><button type="button" id="' + thisStation.ID + '" onClick="AddToRoute(this); return false;">Add to Route</button><br /><button type="button" id="' + thisStation.ID + '" onClick="displayChargerInfo(this); return false;">Station Info</button></form></td><td>'
        + '</table>'
        + '</div>';

    return html;
}

// displayChargerInfo(thisBtn)
// Display Info Page
function displayChargerInfo(thisBtn) {
    var thisID;
    thisID = thisBtn.id;

    var myStation = myOCM.getStationByID(thisID);

    if (myStation == "-1") alert("Error getting charging station data");

    // get new window but closed
    $.get("chargestationinfo1.html", function (myWindow) {
        html = $.parseHTML(myWindow);

        // Title
        html.getElementById("pgTitle").innerHTML = "<u><h3>" + myStation.AddressInfo.Title + "</h3></u>";

        myWindow.focus();
    });
}

// AddToRoute(Button thisBtn)
// Runs when "Add to Route" button is clicked
//
// - adds station to route
// - resets circle center
function AddToRoute(thisBtn) {

    var thisID;
    thisID = thisBtn.id;

    myRoute.addWaypointToEnd(thisID);

    // reload OCM data from new center
    circleLatlng = myRoute.getWaypointLatlng(thisID);
    myOCMoptions.center = circleLatlng;
    myOCM.LoadStations(myOCMoptions);
    
    // Recalc route with new waypoints
    routeWaypoints = myRoute.getAllWaypointLocations();
    getDirectionsClick();
    
}

function onGDirectionsLoad(){ 
	var poly = gdir.getPolyline();
	if (poly.getVertexCount() > 100) {
		 alert("This route has too many vertices");
		 return;
	}
	var baseUrl = "http://maps.google.com/staticmap?";
	
	var params = [];
	var markersArray = [];
	markersArray.push(poly.getVertex(0).toUrlValue(5) + ",greena");
	markersArray.push(poly.getVertex(poly.getVertexCount()-1).toUrlValue(5) + ",greenb");
	params.push("markers=" + markersArray.join("|"));
	
	var polyParams = "rgba:0x0000FF80,weight:5|";
	var polyLatLngs = [];
	for (var j = 0; j < poly.getVertexCount(); j++) {
	 	polyLatLngs.push(poly.getVertex(j).lat().toFixed(5) + "," + poly.getVertex(j).lng().toFixed(5));
	}
	params.push("path=" + polyParams + polyLatLngs.join("|"));
	params.push("size=300x300");
	params.push("key=ABQIAAAAjU0EJWnWPMv7oQ-jjS7dYxSPW5CJgpdgO_s4yyMovOaVh_KvvhSfpvagV18eOyDWu7VytS6Bi1CWxw");
	
	baseUrl += params.join("&");
	
    // Add centre pin
	//var extraParams = [];
	//extraParams.push("center=" + map.getCenter().lat().toFixed(6) + "," + map.getCenter().lng().toFixed(6));
	//extraParams.push("zoom=" + map.getZoom());
	//addImg(baseUrl + "&" + extraParams.join("&"), "staticMapOverviewIMG");
	
    // Add start pin
	var extraParams = [];
	extraParams.push("center=" + poly.getVertex(0).toUrlValue(5));
	extraParams.push("zoom=" + 15);
	addImg(baseUrl + "&" + extraParams.join("&"), "staticMapStartIMG");
	
    // Add end pin
	var extraParams = [];
	extraParams.push("center=" + poly.getVertex(poly.getVertexCount()-1).toUrlValue(5));
	extraParams.push("zoom=" + 15);
	addImg(baseUrl + "&" + extraParams.join("&"), "staticMapEndIMG");
}

function addImg(url, id) {
	var img = document.createElement("img");
	img.src = url;
	document.getElementById(id).innerHTML = "";
	document.getElementById(id).appendChild(img);
}

function GetLatLngFromAddress(address, callback) {
    var geocoder = new google.maps.Geocoder();
    geocoder.geocode({ 'address': address }, function (results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var latitude = results[0]['geometry']['location'].lat();
            var longitude = results[0]['geometry']['location'].lng();
            var ll = results[0].geometry.location;
            callback(ll);
        } else {
            alert("Geocode Request Failed.")
        }
    });
};

function reset() {
    clearMapMarkers();
    clearMapCircles();
    directionsDisplay.setMap(null);
    directionsDisplay.setPanel(null);
    directionsDisplay = new google.maps.DirectionsRenderer();
    directionsDisplay.setMap(map);
    directionsDisplay.setPanel(document.getElementById("directionsPanel"));

}

function getOCMRefData() {
    $.ajax({
        url: "http://api.openchargemap.io/v2/referencedata/",
        dataType: 'json',
        async: false,
        success: function (data) {
            OCMRefData = data;
        },
        error: function () {
            alert('Error getting OCM Ref Data');
        }
    });
}

function setSelectLevel() {

    // default
    selectedLevel = "1";
    below = false;

    // set selected level
    if (enteredFastChargers)
        selectedLevel = "2";

    if (enteredRapidChargers)
        selectedLevel = "3";

    if (enteredFastChargers && enteredRapidChargers)
        below = true;
}

// Handles returned Geocoder errors
function handleErrors() {
    if (gdir.getStatus().code == G_GEO_UNKNOWN_ADDRESS)
        alert("No corresponding geographic location could be found for one of the specified addresses. This may be due to the fact that the address is relatively new, or it may be incorrect.\nError code: " + gdir.getStatus().code);
    else if (gdir.getStatus().code == G_GEO_SERVER_ERROR)
        alert("A geocoding or directions request could not be successfully processed, yet the exact reason for the failure is not known.\n Error code: " + gdir.getStatus().code);
    else if (gdir.getStatus().code == G_GEO_MISSING_QUERY)
        alert("The HTTP q parameter was either missing or had no value. For geocoder requests, this means that an empty address was specified as input. For directions requests, this means that no query was specified in the input.\n Error code: " + gdir.getStatus().code);
    else if (gdir.getStatus().code == G_GEO_BAD_KEY)
        alert("The given key is either invalid or does not match the domain for which it was given. \n Error code: " + gdir.getStatus().code);
    else if (gdir.getStatus().code == G_GEO_BAD_REQUEST)
        alert("A directions request could not be successfully parsed.\n Error code: " + gdir.getStatus().code);
    else alert("An unknown error occurred.");
}

google.maps.event.addDomListener(window, 'load', loadMap);

