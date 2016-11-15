var Meditation = (function() {

	var jsonUrl = '/pages/meditation/data/meditation_haiku.json';
	var page    = '/pages/meditation.html';
	var haikuData;
	var haikuById         = {}; // all haiku indexed by their id
	var haikuListsByTheme = {}; // a list of haiku id for each theme
	var coreThemes        = []; // a list of themes
	var okAuthorsHash     = {}; // a hash of authors with more than one haiku
	var okAsThemesHash    = {}; // a hash of all core themes and ok authors
	var numHaiku;
	var defaultHaiku = 1;
	var defaultTheme = 'IMAGERY';
	var genericTheme = "DATE";

	function urlParam(name){
	    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
	    if (results==null){
	       return null;
	    }
	    else{
	       return results[1] || 0;
	    }
	}

	// Returns a random integer between min (included) and max (included)
	// Using Math.round() will give you a non-uniform distribution!
	function getRandomIntInclusive(min, max) {
	  min = Math.ceil(min);
	  max = Math.floor(max);
	  return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	function getAndProcessJsonThen( thenFn ) {
		var oReq    = new XMLHttpRequest();
		oReq.onload = processJson;
		oReq.open("get", jsonUrl, true);
		oReq.send();

		function processJson(e) {
			if (this.status == 200) {
				haikuData = JSON.parse(this.responseText);
				
				var count = 0;
				var knownCoreThemes = {};
				var knownAuthors    = {};

				haikuData.forEach(function(haiku){
					count = count + 1;
					var id = 'Id' + count; // for now, the haiku id is the index of it in the input data
					haiku['Id'] = id;
					haikuById[id] = haiku;

					haiku['ProminentColoursByName'] = {};
					haiku['ProminentColours'].forEach(function(pc){
						haiku['ProminentColoursByName'][pc['Name']] = pc;
					});

					haiku['Themes'].push(genericTheme);

					haiku['Themes'].forEach(function(theme){
						if (! (theme in knownCoreThemes)) {
							haikuListsByTheme[theme] = [];
							knownCoreThemes[theme] = true;
						};
						haikuListsByTheme[theme].push(id);
					});

					var author = haiku['Author'];
					if (! (author in haikuListsByTheme)) {
						haikuListsByTheme[author] = [];
						knownAuthors[author] = true;
					};
					haikuListsByTheme[author].push(id);

					Object.keys(knownCoreThemes).forEach(function(theme){
						if (haikuListsByTheme[theme].length > 1) {
							coreThemes.push(theme);
						};
					});

					defaultTheme = coreThemes[0] || Object.keys(haikuListsByTheme)[0];

					console.log('processJson: id=' + id + ', themes=' + JSON.stringify(haiku['Themes']) + ', title=' + haiku['Title']);
				});

				Object.keys(knownAuthors).forEach(function(author){
					if (haikuListsByTheme[author].length > 1) {
						okAuthorsHash[author] = true;
					};
				});

				// combine core themes and ok authors into okAsThemesHash

				Object.keys(okAuthorsHash).forEach(function(author){
					okAsThemesHash[author] = true;
				});				

				coreThemes.forEach(function(theme){
					okAsThemesHash[theme] = true;
				});

				numHaiku = haikuData.length;

				console.log('processJson: haikuListsByTheme=' + JSON.stringify(haikuListsByTheme));
			}
			thenFn();
		}
	}

	// given a haiku (by id) and a theme,
	// if the theme is invalid, use the default theme.
	// if the id is invalid, use the first haiku from the theme
	//    else lookup the index of the haiku in the them, and get the next haiku in the sequence, wrapping to first if at end of list
	function getNextDetails( id, theme, direction=1 ) {
		console.log('getNextDetails: id=' + id + ', theme=' + theme + ', direction=' + direction );
		if ( ! okAsThemesHash[theme] ) {
			theme = defaultTheme;
		};

		var haikuList = haikuListsByTheme[theme];
		var indexOfIdInTheme = haikuList.indexOf(id);

		if (indexOfIdInTheme == -1) {
			indexOfIdInTheme = 0;
		};
		var nextIndex = indexOfIdInTheme + direction;
		if (nextIndex < 0) {
			nextIndex = haikuList.length -1;
		} else if (nextIndex >= haikuList.length) {
			nextIndex = 0;
		};

		var nextId = haikuList[nextIndex];

		var details = {
			id:    nextId,
			theme: theme,
			haiku: haikuById[nextId]
		};

		console.log('getNextDetails: details=' + JSON.stringify(details));

		return details;
	}

	function constructPageUrl( id, theme ) {
		return page + '?haiku=' + id + '&theme=' + theme;
	}

	function setPageUrlForNextHaiku( id, theme , direction=1) {
		var nextDetails = getNextDetails( id, theme, direction );
		var nextUrl     = constructPageUrl( nextDetails['id'], nextDetails['theme'] );
		var nextTitle   = "FT Hidden Haiku: " + nextDetails['theme'] ;
		console.log('setPageUrlForNextHaiku" nextUrl=' + nextUrl + ", nextTitle=" + nextTitle);
		window.history.pushState({}, nextTitle, nextUrl);

	}

	function getElementByClass(name) {
		return document.getElementsByClassName(name)[0];
	}

	function displayHaiku() {
		var details = getNextDetails(urlParam('haiku'), urlParam('theme'), 0)
		var haikuId = details['id'];
		var theme   = details['theme'];
		var haiku   = details['haiku'];

		// locate haiku
		// - have fallback if not found
		// construct card
		// - image
		// - text
		// - author
		// - buttons
		// -- create a Next/Previous button, and the remaining theme buttons
		// inject into page 

		var cardElt = getElementByClass("haiku-card");
		var prominentColor = haiku['ProminentColours'][0];
		if ('LightMuted' in haiku['ProminentColoursByName']) {
			prominentColor = haiku['ProminentColoursByName']['LightMuted'];
		};
		cardElt.style.backgroundColor = prominentColor['RGBHex'];

		var textElt = getElementByClass("haiku-text");
		textElt.innerHTML = haiku['TextWithBreaks'];

		var imgElt = getElementByClass("haiku-image");
		imgElt.src = haiku['ImageUrl'];

		var authorElt = getElementByClass("haiku-author");
		authorElt.innerHTML = haiku['Author'];

		var themeElt = getElementByClass("haiku-theme");
		themeElt.innerHTML = theme;

		var nextElt = getElementByClass("haiku-next");
		nextElt.onclick = function() {
			setPageUrlForNextHaiku(haikuId, theme);
			displayHaiku();
		};

		var prevElt = getElementByClass("haiku-prev");
		prevElt.onclick = function() {
			setPageUrlForNextHaiku(haikuId, theme, -1);
			displayHaiku();
		};

		var candidateThemes = haiku['Themes'].slice();
		candidateThemes.push(haiku['Author']);
		var remainingThemes = [];

		candidateThemes.forEach(function(t){
			if ( t !== theme && okAsThemesHash[t] ) {
				remainingThemes.push(t);
			};
		});		

		var buttons = [];
		remainingThemes.forEach(function(t){
			var button = document.createElement("BUTTON");
			button.appendChild( document.createTextNode(t) );
			button.onclick = function(){
				setPageUrlForNextHaiku(haikuId, t);
				displayHaiku();
			};
			buttons.push(button);
		});

		var navElt = getElementByClass("haiku-themes");
		navElt.innerHTML = "";
		buttons.forEach(function(button){
			navElt.appendChild(button);
		});

	}

	return {
		getAndProcessJsonThen:  getAndProcessJsonThen,
		displayHaiku: 			displayHaiku
	};

})();

Meditation.getAndProcessJsonThen( Meditation.displayHaiku );
