var Meditation = (function() {

	var jsonUrl = '/pages/meditation/meditation_haiku.json';
	var page    = '/pages/meditation.html';
	var haikuData;
	var haikuById         = {}; // all haiku indexed by their id
	var haikuListsByTheme = {}; // a list of haiku id for each theme
	var coreThemes        = []; // a list of themes
	var okAuthorsHash     = {}; // a hash of authors with more than one haiku
	var okAsThemesHash    = {}; // a hash of all core themes and ok authors
	var numHaiku;
	var defaultHaiku = 1;
	var defaultTheme = 'DATE';    // if no theme is specified, choose this one
	var genericTheme = "DATE";    // every haiku has this theme
	var maxButtonTextLength = 10;
	var lineThreshold = 26;

	function urlParam(name){
	    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
	    if (results==null){
	       return null;
	    }
	    else{
	       return decodeURIComponent(results[1]) || 0;
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
					if (!('Id' in haiku)) {
						haiku['Id'] = 'Id' + count;
					};
					var id = haiku['Id']
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

					if (!(defaultTheme in haikuListsByTheme)) {
						defaultTheme = coreThemes[0] || Object.keys(haikuListsByTheme)[0];
					};
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
			}
			thenFn();
		}
	}

	// given a haiku (by id) and a theme,
	// if the theme is invalid, use the default theme.
	// if the id is invalid, use the first haiku from the theme
	//    else lookup the index of the haiku in the them, and get the next haiku in the sequence, wrapping to first if at end of list
	function getNextDetails( id, theme, direction=1 ) {
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

		return details;
	}

	function constructPageUrl( id, theme ) {
		return page + '?haiku=' + id + '&theme=' + theme;
	}

	function setPageUrlForNextHaiku( paramsWithoutDefaults ) {
		var defaults = {
			direction: 1,
			nextIn   : 0
		};
		var params = Object.assign(defaults, paramsWithoutDefaults);

		var nextDetails = getNextDetails( params.id, params.theme, params.direction );
		var nextUrl     = constructPageUrl( nextDetails['id'], nextDetails['theme'] );
		if (params.nextIn > 0) {
			nextUrl = nextUrl + '&next-in=' + params.nextIn;
		};
		if (params.kioskMode) {
			nextUrl = nextUrl + '&kiosk=true';
		};
		if (params.randomWalkMode) {
			nextUrl = nextUrl + '&randomwalk=true';
		}
		var nextTitle   = "FT Hidden Haiku: " + nextDetails['theme'] ;
		window.history.pushState({}, nextTitle, nextUrl);
	}

	function getElementByClass(name) {
		return document.getElementsByClassName(name)[0];
	}

	function calcButtonDisplayText(t, haiku) {
		var displayT;
		if(t == 'DATE') {
			displayT = haiku['PubDateString'].split('T')[0];
		} else if (t in okAuthorsHash) {
			displayT = 'AUTHOR';
		} else if (t.length > maxButtonTextLength) {
			displayT = t.substring(0,maxButtonTextLength);
		} else {
			displayT = t;
		};

		return displayT;
	}

	function longestLineLength(text) {
		var lines = text.split('<BR>');
		var max = 0;
		lines.forEach(function(line){
			max = (line.length>max)? line.length : max;
		});
		return max;
	}

	function displayHaiku() {
		var details = getNextDetails(urlParam('haiku'), urlParam('theme'), 0)
		var nextIn         = urlParam('next-in');
		var kioskMode      = (urlParam('kiosk')      != null);
		var randomWalkMode = (urlParam('randomwalk') != null);

		var haikuId = details['id'];
		var theme   = details['theme'];
		var haiku   = details['haiku'];

		var numThemes = haiku['Themes'].length;
		if (randomWalkMode && numThemes > 1) {
			theme = haiku['Themes'][Math.floor(Math.random() * numThemes)];
		};

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
		} else if ('Muted' in haiku['ProminentColoursByName']) {
			prominentColor = haiku['ProminentColoursByName']['Muted'];
		} else if ('Vibrant' in haiku['ProminentColoursByName']) {
			prominentColor = haiku['ProminentColoursByName']['Vibrant'];
		};
		cardElt.style.backgroundColor = prominentColor['RGBHex'];

		var textElt = getElementByClass("haiku-text");
		if (longestLineLength(haiku['TextWithBreaks']) > lineThreshold) {
			textElt.classList.add('haiku-too-long');
		} else {
			textElt.classList.remove('haiku-too-long');
		};
		textElt.innerHTML = haiku['TextWithBreaks'];

		var imgElt = getElementByClass("haiku-image");
		imgElt.src = haiku['ImageUrl'];

		var imgLinkElt = getElementByClass("haiku-image-link");
		imgLinkElt.href = haiku['Url'];

		var authorElt = getElementByClass("haiku-author");
		authorElt.innerHTML = haiku['Author'];

		var navElt = getElementByClass('haiku-nav');
		if (kioskMode) {
			navElt.classList.add('hide');
		} else {			
			navElt.classList.remove('hide');
		};

		var themeElt = getElementByClass("haiku-theme");
		themeElt.innerHTML = calcButtonDisplayText(theme, haiku);

		var timeoutId;
		if (nextIn > 0) {
			var fnNextIn = function() {
				setPageUrlForNextHaiku({
					id: haikuId, 
					theme: theme, 
					direction: +1, 
					nextIn: nextIn,
					kioskMode: kioskMode,
					randomWalkMode: randomWalkMode
				});
				displayHaiku();
			};
			timeoutId = window.setTimeout(fnNextIn, nextIn*1000);
		};

		var fnPrev = function() {
			window.clearTimeout(timeoutId);
			setPageUrlForNextHaiku({
				id: haikuId, 
				theme: theme,
				kioskMode: kioskMode,
				randomWalkMode: randomWalkMode
			});
			displayHaiku();
		};

		var fnNext = function() {
			window.clearTimeout(timeoutId);
			setPageUrlForNextHaiku({
				id: haikuId, 
				theme: theme, 
				direction: -1,
				kioskMode: kioskMode,
				randomWalkMode: randomWalkMode
			});
			displayHaiku();
		};

		var nextElt = getElementByClass("haiku-next");
		nextElt.onclick = fnPrev;

		var prevElt = getElementByClass("haiku-prev");
		prevElt.onclick = fnNext;

		document.onkeydown = function() {
			switch (window.event.keyCode) {
				case 37: // left key
					fnPrev();
				break;
				case 38: // up key
				break;
				case 39: // right key
					fnNext();
				break;
				case 40: // down
				break;
			}		
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
			button.className = 'haiku-button';
			button.appendChild( document.createTextNode(calcButtonDisplayText(t, haiku)) );
			button.onclick = function(){
				window.clearTimeout(timeoutId);
				setPageUrlForNextHaiku({
					id: haikuId, 
					theme: t,
					kioskMode: kioskMode
				});
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
