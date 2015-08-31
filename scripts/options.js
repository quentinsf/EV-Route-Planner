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

var OCMRefData;

var Operators
    , ChargerTypes
    , ConnectionTypes
    , CurrentTypes
    , Countries
    , DataProviders
    , StatusTypes
    , SubmissionStatusTypes
    , UsageTypes;


function doOnLoad_options() {

    loadRefData();

    if (Modernizr.localstorage) {
        loadStoredOptions();
    } else {
        alert('Data cannot be stored. Use a more modern browser');
    }

    amplify.clearStore = function () {
        $.each(amplify.store(), function (storeKey) {
            // Delete the current key from Amplify storage
            amplify.store(storeKey, null);
        });
    };
}

function doOnUnload_options() {
}

function loadRefData() {
    OCMRefData = getOCMRefData();

    Operators = OCMRefData.Operators;
    ChargerTypes = OCMRefData.ChargerTypes;
    ConnectionTypes = OCMRefData.ConnectionTypes;
    CurrentTypes = OCMRefData.CurrentTypes;
    Countries = OCMRefData.Countries;
    DataProviders = OCMRefData.DataProviders;
    StatusTypes = OCMRefData.StatusTypes;
    UsageTypes = OCMRefData.UsageTypes;

    loadOperators();
    loadCars();
    loadConnectionTypes();

}

function loadStoredOptions() {

    getStoredOptions();

    if (!model) return;

    $('#car').val(model);
    $('#range').val(range);
    $('#distanceUnits').val(distanceUnits);
    $('#powerUse').val(powerUse);
    $('#powerUnits').val(powerUnits);
    $('#plugs').val(plugs);
    $('#fastestShortest').val(fastestShortest);
    $('#SOCatEndofLeg').val(SOCatEndofLeg);
    $('#SOCatEndofCharge').val(SOCatEndofCharge);
    $('#minStopTime').val(minStopTime);
    $('#preferredNetworks').val(preferredNetworks);
    $('input[name="preferredLevel"]').val([preferredLevel]);

}

function setModelData() {

    model = $('#car').val();
    if (!model) return;

    var range = Cars[model].range;
    $('#range').val(range);

    var powerUse = Cars[model].powerUse;
    $('#powerUse').val(powerUse);

    var plugs = Cars[model].plugs;
    $('#plugs').val(plugs);

}

function finished() {
    saveStoredData();
    window.opener.updateOptions();
    close();
}

function saveStoredData() {

    model = $('#car').val();
    amplify.store.localStorage('EVZone.Planner.Model', model);

    range = $('#range').val();
    amplify.store.localStorage('EVZone.Planner.range', range);

    distanceUnits = $('#distanceUnits').val();
    amplify.store.localStorage('EVZone.Planner.distanceUnits', distanceUnits);

    powerUse = $('#powerUse').val();
    amplify.store.localStorage('EVZone.Planner.powerUse', powerUse);

    powerUnits = $('#powerUnits').val();
    amplify.store.localStorage('EVZone.Planner.powerUnits', powerUnits);

    plugs = $('#plugs').val();
    amplify.store.localStorage('EVZone.Planner.plugs', plugs);

    fastestShortest = $('#fastestShortest').val();
    amplify.store.localStorage('EVZone.Planner.fastestShortest', fastestShortest);

    SOCatEndofLeg = $('#SOCatEndofLeg').val();
    amplify.store.localStorage('EVZone.Planner.SOCatEndofLeg', SOCatEndofLeg);

    SOCatEndofCharge = $('#SOCatEndofCharge').val();
    amplify.store.localStorage('EVZone.Planner.SOCatEndofCharge', SOCatEndofCharge);

    minStopTime = $('#minStopTime').val();
    amplify.store.localStorage('EVZone.Planner.minStopTime', minStopTime);

    preferredNetworks = $('#preferredNetworks').val();
    amplify.store.localStorage('EVZone.Planner.preferredNetworks', preferredNetworks);

    preferredLevel = $('input[name="preferredLevel"]:checked').val();
    amplify.store.localStorage('EVZone.Planner.preferredLevel', preferredLevel);

}

function loadOperators() {
    //get a reference to the select element
    var $select = $('#preferredNetworks');

    //clear the current content of the select
    $select.html('');

    //iterate over the data and append a select option
    $.each(Operators, function (key, val) {
        $select.append('<option id="' + val.ID + '">' + val.Title + '</option>');
    });
}

function loadCars() {

    //get a reference to the select element
    var $select = $('#car');

    //clear the current content of the select
    $select.html('');

    //iterate over the data and append a select option
    $.each(Cars, function (key, val) {
        $select.append('<option value="' + val.ID + '">' + val.car + '</option>');
    });

    $('#car').val(defaultCar);
    setModelData();
}

function loadConnectionTypes() {
    //get a reference to the select element
    var $select = $('#plugs');

    //clear the current content of the select
    $select.html('');

    //iterate over the data and append a select option
    $.each(ConnectionTypes, function (key, val) {
        $select.append('<option value="' + val.ID + '">' + val.Title + '</option>');
    });

}

function resetOptions() {
    amplify.clearStore();
    window.location.reload();
}
