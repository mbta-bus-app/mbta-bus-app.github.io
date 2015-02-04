var storage = function(key, value) {
  if (_.isUndefined(value)) {
    try {
      return JSON.parse(window.localStorage.getItem(key));
    } catch (e) {
      return void(0);
    }
  } else {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
};

var displayTime = function(seconds) {
  var s = parseFloat(seconds);
  if (s > 0) {
    return (Math.floor(s / 60).toString() + 'm ' +
            (s % 60).toString() + 's');
  } else {
    return '...';
  }
};

var formatPredictionRow = function(prediction) {
  return '<li class="list-group-item">&nbsp;' +
    '<span class="label label-primary pull-left route">' +
    prediction.route + '</span>' +
    '<span class="label label-info pull-left direction">' +
    prediction.direction + '</span>&nbsp;' +
    '<span class="badge pull-right time">' +
    displayTime(prediction.seconds) + '</span></li>';
};

var tickDown = function(time) {
  var match = /^(\d+)m\s+(\d+)s$/.exec(time);
  if (match) {
    var min = parseInt(match[1]);
    var sec = parseInt(match[2]);
    return displayTime((60 * min) + sec - 1);
  } else {
    return time;
  }
};

var parsePredictions = function(xhrResult) {
  var ret = [];
  $(xhrResult).find('predictions').each(function() {
    var route = $(this).attr('routeTitle');
    $(this).find('direction').each(function() {
      var direction = $(this).attr('title');
      $(this).find('prediction').each(function() {
        ret.push({
          route: route,
          direction: direction,
          seconds: $(this).attr('seconds')
        });
      });
    });
  });
  return _.sortBy(ret, function(p) {
    return parseFloat(p.seconds);
  });
};

var closeMenus = function() {
  $('#menu-nav').find('li').removeClass('active');
  $('.menu').hide();
};

var setupFavorites = function() {
  var $menu = $('.menu.favorites');
  var $list = $menu.find('.list-group');
  var favorites = storage('favorites');
  $list.empty();
  _.each(favorites, function(stopId) {
    var stop = _.findWhere(stops, {id: stopId});
    $list.append('<li class="list-group-item" data-id="' + stop.id +
                 '" data-lat="' + stop.lat + '" data-lon="' +
                 stop.lon + '" data-title="' + stop.title +
                 '">' + stop.title + '</li>');
  });
  $list.find('.list-group-item').click(function() {
    stop = $(this).data();
    setLocation(stop.lat, stop.lon, 17);
    window.currentStop = stop;
    loadStop(stop);
    closeMenus();
  });
};

var toggleFavorite = function(stop) {
  var favorites = storage('favorites') || [];
  var index = favorites.indexOf(stop.id);
  if (index !== -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(stop.id);
  }
  storage('favorites', favorites);
  checkFavorite(stop);
  setupFavorites();
};

var checkFavorite = function(stop) {
  var favorites = storage('favorites') || [];
  if (favorites.indexOf(stop.id) !== -1) {
    $('.favorite').find('span')
      .removeClass('glyphicon-star-empty')
      .addClass('glyphicon-star')
      .css({color: '#d90'});
  } else {
    $('.favorite').find('span')
      .addClass('glyphicon-star-empty')
      .removeClass('glyphicon-star')
      .css({color: '#000'});
  }
};

var openStop = function(stop, xhrResult) {
  var $box = $('#predictions');
  var $head = $box.find('.panel-heading');
  var predictions = parsePredictions(xhrResult);
  var p;
  checkFavorite(stop);
  $head.find('.title').html(stop.title);
  $box.find('.list-group').html('');
  for (var i = 0; i < predictions.length; i++) {
    $box.find('.list-group').append(formatPredictionRow(predictions[i]));
  }
  $('#map').css('width', '70%');
  $box.show();
};

var loadStop = function(stop) {
  $('#predictions').find('.loading').css({ display: 'block' });
  $('#predictions').find('.refresh').hide();
  $.ajax({
    type: 'GET',
    url: 'http://webservices.nextbus.com/service/publicXMLFeed' +
      '?command=predictions&a=mbta&stopId=' + stop.id,
    dataType: 'xml',
    success: function(data) {
      $('#predictions').find('.loading').css({ display: 'none' });
      $('#predictions').find('.refresh').show();
      openStop(stop, data);
    },
    error: function() {
      $('#predictions').find('.loading').css({ display: 'none' });
      $('#predictions').find('.refresh').show();
      console.log('An Error occurred');
    }
  });
};

var autoReload = function() {
  if (currentStop) {
    loadStop(currentStop);
  }
  setTimeout(autoReload, 60 * 1000);
};

var currentStop;
var initialLocation;
var boston = { lat: 42.38, lng: -71.1, zoom: 12 };
var browserSupportFlag;
var map;
function setLocation(lat, lng, zoom) {
  map.setCenter(new google.maps.LatLng(lat, lng));
  map.setZoom(zoom);
}

function setLocationToNonGeolocatedDefault() {
  if (storage('zoom') && storage('lat') && storage('lng')) {
    setLocation(storage('lat'), storage('lng'), storage('zoom'));
  } else {
    setLocation(boston.lat, boston.lng, boston.zoom);
  }
}

var geolocate = function() {
  // Try W3C Geolocation (Preferred)
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      setLocation(position.coords.latitude, position.coords.longitude, 17);
    }, function() {
    }, {
      timeout: 7000
    });
  }
};

function initialize() {
  var myOptions = {
    zoom: 12,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };
  map = new google.maps.Map(document.getElementById("map"), myOptions);
  setLocationToNonGeolocatedDefault();
  geolocate();

  google.maps.event.addListener(map, 'bounds_changed', function() {
    storage('zoom', map.getZoom());
    storage('lat', map.getCenter().lat());
    storage('lng', map.getCenter().lng());
  });

  for (var i = 0; i < stops.length; i++) {
    (function(stop) {
      var pos =  new google.maps.LatLng(stop.lat, stop.lon);
      var marker = new google.maps.Marker({
        position: pos,
        map: map,
        title: stop.title
      });
      google.maps.event.addListener(marker, 'click', function() {
        currentStop = stop;
        loadStop(stop);
      });
    }).call(this, stops[i]);
  }

  $('#predictions').find('.close-predictions').click(function() {
    $('#map').css('width', '100%');
    $('#predictions').hide();
  });

  $('.menu').find('.close-menu').click(function() {
    $('#map').css('width', '100%');
    closeMenus();
  });

  $('#predictions').find('.refresh').click(function() {
    if (currentStop) {
      loadStop(currentStop);
    }
  });

  $('#predictions').find('.favorite').click(function() {
    if (currentStop) {
      toggleFavorite(currentStop);
    }
  });

  $('#menu-nav').find('a.geolocate').click(function(){
    geolocate();
    closeMenus();
  });

  $('#menu-nav').find('a.favorites').click(function() {
    setupFavorites();
    closeMenus();
    $('#menu-nav li.favorites').addClass('active');
    $('.menu.favorites').show();
  });

  $('#menu-nav').find('a.search').click(function() {
    closeMenus();
    $('#menu-nav li.search').addClass('active');
    $('.menu.search').show();
  });

  $('#menu-nav').find('a.settings').click(function() {
    closeMenus();
    $('#menu-nav li.settings').addClass('active');
    $('.menu.settings').show();
  });

  $('.menu.settings').find('.clear-data').click(function() {
    window.localStorage.clear();
  });

  autoReload();
}

google.maps.event.addDomListener(window, 'load', initialize);

var countDownTimer;
var countDown = function() {
  $('.time').each(function() {
    var time = $(this).text();
    $(this).text(tickDown(time));
  });
  countDownTimer = setTimeout(countDown, 1000);
};
countDown();
