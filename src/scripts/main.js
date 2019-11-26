import {ISERE_BOUNDARIES} from "./classes/Constants";
import mapboxgl from "mapbox-gl";
import geojsonExtent from "@mapbox/geojson-extent";

var itinisereConfig = {
  mapboxStyle: "",
  mapboxToken: "",
  mapCenter: [5.547913, 45.349475],
  mapZoom: 9,
  userKey: "",
  apiHost: ""
};

function initMap(selector, postInitCallback) {
  var containerElt = document.querySelector(selector);
  if (containerElt) {
    if (itinisereConfig.mapboxToken) {
      mapboxgl.accessToken = itinisereConfig.mapboxToken;
    }
    var map = new mapboxgl.Map({
      container: containerElt,
      style: itinisereConfig.mapboxStyle,
      center: itinisereConfig.mapCenter,
      zoom: itinisereConfig.mapZoom
    });
    map.addControl(new mapboxgl.NavigationControl());
    map.on('style.load', function () {
      map.addSource("dept", {
        type: "geojson",
        data: ISERE_BOUNDARIES
      });
      map.addLayer({
        id: "dept_boundaries",
        type: "line",
        source: "dept",
        paint: {
          "line-color": "#ef8a64",
          "line-width": 3
        }
      });
      map.fitBounds(geojsonExtent(ISERE_BOUNDARIES), {padding: 10});
      postInitCallback(map);
    });
    return map;
  }
}

function displayTrafficStatus(map) {
  var url = itinisereConfig.apiHost + "/api/traffic/v2/GetTrafficStatus/json?user_key=" + itinisereConfig.userKey;
  var typeColors = {0: "#333", 1: "#63FF00", 2: "#FF9000", 3: "#FF000D"};
  var ajax = new XMLHttpRequest();
  ajax.open('GET', url, true);
  ajax.onload = function () {
    var resp = JSON.parse(ajax.responseText);
    if (resp['Data'] && Array.isArray(resp['Data'])) {
      var features = '{"type": "FeatureCollection", "features": [';
      for (var i = 0; i < resp['Data'].length; i++) {
        if (resp['Data'][i]['Shape'] && resp['Data'][i]['Type']) {
          var trafficType = resp['Data'][i]['Type'];
          features = features + (i === 0 ? '' : ', ') + '{' +
            '"type": "Feature", "properties": {"color": "' + typeColors[trafficType] + '"}, ' +
            '"geometry": {' + toGeoJSON(resp['Data'][i]['Shape']) + '}' +
          '}';
        }
      }
      features += ']}';
      map.addSource("traffic", {
        type: "geojson",
        data: JSON.parse(features)
      });
      map.addLayer({
        id: "traffic_layer",
        type: "line",
        source: "traffic",
        paint: {
          "line-color": ['get', 'color'],
          "line-width": 3
        }
      });
    }
  };
  ajax.send();
}

function displayMountainPasses(map) {
  var url = itinisereConfig.apiHost + "/api/traffic/v2/GetClosureList/json?user_key=" + itinisereConfig.userKey;
  var ajax = new XMLHttpRequest();
  ajax.open('GET', url, true);
  ajax.onload = function () {
    var resp = JSON.parse(ajax.responseText);
    if (resp['Data'] && resp['Data']['Date'] && Array.isArray(resp['Data']['Closures'])) {
      var lastUpdate = new Date(parseInt(resp['Data']['Date'].match(/\d{12,}/)[0]));
      for (var i = 0; i < resp['Data']['Closures'].length; i++) {
        var mountainPass = resp['Data']['Closures'][i];
        var coords = [mountainPass['Coordinates']['Longitude'], mountainPass['Coordinates']['Latitude']];
        if (mountainPass['Name'] && mountainPass['Coordinates']) {
          var el = document.createElement('div');
          el.className = 'mountain_pass_marker';
          el.style.backgroundColor = mountainPass['State'] === 2 ? "#FF000D" : "#08d500";
          new mapboxgl.Marker(el).setLngLat(coords).setPopup(new mapboxgl.Popup({ offset: 10 })
            .setHTML(
              '<div class="mountain_pass_popup">' +
                '<h3>' + mountainPass['Name'] + '</h3>' +
                '<p class="' + (mountainPass['State'] === 2 ? 'closed' : 'open') + '">' + (mountainPass['State'] === 2 ? 'Fermé' : 'Ouvert') + '</p>' +
                '<p><em>Dernière mise à jour : ' + lastUpdate.toLocaleString() + '</em></p>' +
              '</div>'
            ))
            .addTo(map);
        }
      }
    }
  };
  ajax.send();
}

function toGeoJSON(shapeString) {
  var output = shapeString;
  output = output.replace('MULTILINESTRING ', '"type": "MultiLineString", "coordinates": ');
  output = output.replace(/(\d{1,2}\.\d+)(,\s)(\d{1,2}\.\d+)/g, '$1], [$3');
  output = output.replace(/(\d{1,2}\.\d+)(\),\s\()(\d{1,2}\.\d+)/g, '$1]], [[$3');
  output = output.replace(/(\(\()(\d{1,2}\.\d+)/g, '[[[$2');
  output = output.replace(/(\d{1,2}\.\d+)(\)\))/g, '$1]]]');
  output = output.replace(/(\d{1,2}\.\d+)(\s)(\d{1,2}\.\d+)/g, '$1, $3');
  return output;
}

window.itinisereMap = {
  config: itinisereConfig,
  initMap: initMap,
  displayTrafficStatus: displayTrafficStatus,
  displayMountainPasses: displayMountainPasses
};