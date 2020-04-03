(function() {

    mapboxgl.accessToken = 'pk.eyJ1IjoiZHJpbWFjdXMxODIiLCJhIjoiWGQ5TFJuayJ9.6sQHpjf_UDLXtEsz8MnjXw';
    var map = new mapboxgl.Map({
        container: 'map',
        style: 'style3.json',
        // style: 'mapbox://styles/mapbox/streets-v8',
        minZoom: 8, //restrict map zoom
        maxZoom: 18,
        zoom: 11,
        center: [30.598258248737466, 50.46690715898018],
        hash: true,
        tap: false
    });

    window.map = map;

    map.addControl(new mapboxgl.NavigationControl());
    map.scrollZoom.disable();

    var framesPerSecond = 15;
    var initialOpacity = 1;
    var opacity = initialOpacity;
    var initialRadius = 8;
    var radius = initialRadius;
    var maxRadius = 18;

    var projection = (function(){
        var mercator = d3.geoMercator()
            .scale(100000)
            .center([30.598258248737466, 50.46690715898018]);

        var res = function(c){
            var coords = mercator(c);
            coords[1] = -coords[1];
            return coords;
        };

        res.invert = function(c) {
            c[1] = -c[1];
            return mercator.invert(c);
        };

        return res;
    })();

    map.on('load', function (){
        d3.queue()
            .defer(d3.json, "data/crossings.geojson")
            .defer(d3.json, "data/cameras.geojson")
            .await(function(err, crossings, cameras) {
                if (err) throw err;

                var env_string = '__texty__env__dev__';
                
                var tiles_for_env = {
                    '__texty__env__dev__': ["https://drimacus182.github.io/kyiv_crossings/data/fast_points/{z}/{x}/{y}.pbf"],
                    '__texty__env__prod__': ["https://a.texty.org.ua/maps/d/kyiv_crossings/fast_points/{z}/{x}/{y}.pbf", "https://b.texty.org.ua/maps/d/kyiv_crossings/fast_points/{z}/{x}/{y}.pbf", "https://c.texty.org.ua/maps/d/kyiv_crossings/fast_points/{z}/{x}/{y}.pbf"]
                };
                
                var fastpoint_tiles = tiles_for_env[env_string];
            
                // "tiles": ["http://a.texty.org.ua/maps/d/kyiv_crossings/fast_points/{z}/{x}/{y}.pbf", "http://b.texty.org.ua/maps/d/kyiv_crossings/fast_points/{z}/{x}/{y}.pbf", "http://c.texty.org.ua/maps/d/kyiv_crossings/fast_points/{z}/{x}/{y}.pbf"],
                //     "maxzoom": 14
                map.addLayer({
                    "id": "earthquakes-heat",
                    "type": "circle",
                    "source": {
                        type: "vector",
                        tiles: ["https://drimacus182.github.io/kyiv_crossings/data/fast_points/{z}/{x}/{y}.pbf"]
                    },
                    "source-layer": "fast",


                    "paint": {
                        'circle-color': "#ffbb22",
                        'circle-radius': {
                            base: 1,
                            stops: [
                                [10, 2],
                                [16, 5]
                            ]
                        },
                        "circle-opacity": {
                            property: 'density',
                            // base: 2,
                            stops: [
                                [1, 0.05],
                                [30, 0.7]
                            ]
                        }
                    }
                });

                map.addLayer({
                    'id': 'crossings',
                    'type': 'circle',
                    'source': {
                        type: 'geojson',
                        data: crossings
                    },
                    // 'source-layer': 'sf2010',
                    'paint': {
                        'circle-color': "#EF5223",
                        "circle-opacity": 0.8,
                        'circle-radius': {
                            base: 1,
                            stops: [
                                [10, 4],
                                [16, 10],
                                [18, 14]
                            ]
                        }
                    }
                });

                map.addLayer({
                    'id': 'crossings-hover',
                    'type': 'circle',
                    'source': {
                        type: 'geojson',
                        data: crossings
                    },
                    'paint': {
                        "circle-color": "#EF5223",
                        "circle-opacity": 0.8,
                        "circle-radius": {
                            base: 1,
                            stops: [
                                [10, initialRadius],
                                [16, initialRadius * 2],
                                [18, initialRadius * 3]
                            ]
                        },
                        "circle-radius-transition": {duration: 0},
                        "circle-opacity-transition": {duration: 0}
                    },
                    filter: ["==", "osm_id", ""]
                });

                map.addLayer({
                    'id': 'crossings-clickable',
                    'type': 'circle',
                    'source': {
                        type: 'geojson',
                        data: crossings
                    },
                    // 'source-layer': 'sf2010',
                    'paint': {
                        'circle-color': "#EF5223",
                        "circle-opacity": 0.1,
                        'circle-radius': {
                            base: 1,
                            stops: [
                                [10, 4 + 8],
                                [16, 10 + 6],
                                [18, 14 + 4]
                            ]
                        }
                    }
                });

                function animateMarker(timestamp) {
                    setTimeout(function(){
                        requestAnimationFrame(animateMarker);

                        radius += (maxRadius - radius) / framesPerSecond;
                        opacity -= ( .9 / framesPerSecond );

                        if (opacity <= 0) {
                            radius = initialRadius;
                            opacity = initialOpacity;
                        }

                        map.setPaintProperty('crossings-hover', 'circle-radius', radius);
                        map.setPaintProperty('crossings-hover', 'circle-opacity', opacity);

                    }, 1000 / framesPerSecond);
                }

                // Start the animation.
                animateMarker(0);

                map.on('click', "crossings-clickable", function(e) {
                    map.setFilter("crossings-hover", ["==", "osm_id", e.features[0].properties.osm_id.toString()]);

                    var features = e.features;

                    // if the features have no info, return nothing
                    if (!features.length) {
                        return;
                    }

                    var crossing = features[0];
                    console.log(crossing);

                    var camera = cameras.features.filter(function(f) {
                        return f.properties.osm_id == crossing.properties.osm_id
                    })[0];

                    var html = iframe({
                        src: embed_str(crossing, camera, 0.3),
                        width: "100%",
                        height: "100%"
                    });

                    var popup = new mapboxgl.Popup()
                        .setLngLat(crossing.geometry.coordinates)
                        .setHTML(html)
                        .addTo(map);

                    popup.on('close', function(e) {
                        map.setFilter("crossings-hover", ["==", "osm_id", ""]);
                    })
                });
            });
    });

    map.on('mousemove', "crossings-clickable", function(e) {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', "crossings-clickable", function(e) {
        map.getCanvas().style.cursor = '';
    });

    function embed_str(crossing, camera, distance) {
        var crossing_c = crossing.geometry.coordinates;
        var camera_c = camera.geometry.coordinates;

        var crossing_mercator = projection(crossing_c);
        var camera_mercator = projection(camera_c);

        var heading = angle(crossing_mercator, camera_mercator);

        var vec = [crossing_mercator[0] - camera_mercator[0], crossing_mercator[1] - camera_mercator[1]];
        var vec_length = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2));
        var vec_cor = [vec[0] / vec_length * distance , vec[1] / vec_length * distance];

        var camera_cor_mercator = [crossing_mercator[0] - vec_cor[0], crossing_mercator[1] - vec_cor[1]];

        var camera_cor = projection.invert(camera_cor_mercator);

        // give here coordinates in mercator
        function angle(crossing, camera) {
            var vec = [crossing[0] - camera[0], crossing[1] - camera[1]];
            var angle = Math.atan2(vec[1], vec[0]) * 180 / Math.PI;

            return (-angle + 90 + 360) % 360;
        }

        return "https://www.google.com/maps/embed/v1/streetview?key=AIzaSyDjcBDKy_BzLLd5Uzh_Ihlmyk3uE6GGMBM" +
            "&location=" + camera_cor[1] + "," + camera_cor[0] +
        "&heading=" + heading + "&pitch=0&fov=80";
    }

    function iframe(p) {
        return "<iframe frameborder='0' style='border:0' allowfullscreen='true' width='{width}' height='{height}' src='{src}'></iframe>"
            .replace("{width}", p.width)
            .replace("{height}", p.height)
            .replace("{src}", p.src) + "<div class='popup-overlay'></div>"
    }

})();


