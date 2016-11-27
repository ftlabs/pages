var Meditation = (function() {

	var jsonUrl = '/pages/meditation/meditation_haiku.json';
	var page    = '/pages/meditation.html';
	var haikuById         = {}; // all haiku indexed by their id
	var haikuListsByTheme = {}; // a list of haiku id for each theme
	var coreThemes        = []; // a list of themes
	var knownAuthorsHash  = {}; // a hash of all known authors
	var okAuthorsHash     = {}; // a hash of authors with more than one haiku
	var authorOptions     = []; // a list of Option elements, one per author
	var okAsThemesHash    = {}; // a hash of all core themes and ok authors
	var defaultHaiku = 1;
	var defaultTheme = 'DATE';    // if no theme is specified, choose this one
	var genericTheme = "DATE";    // every haiku has this theme
	var maxButtonTextLength = 11;
	var lineThreshold = 26;
	var defaultNextIn = 8;
	var explanationTheme = 'Explanation/Help';
	var explanations = [
		"words are written once<br>but FT's Hidden Haiku<br>lets us read them twice",
		"these fragments of text<br>there but sitting unnoticed<br>in real articles",
		"for naive Haiku<br>five, seven, five syllables<br>three lines, no rhyming",
		"short observations<br>impressionistic, wistful<br>juxtapositions",
		"with hidden haiku<br>out come powerful moments<br>serendipity",
		'for more on haiku<br>look in <a href="https://en.wikipedia.org/wiki/Haiku_in_English">wikipedia</a><br>or the <a href="http://labs.ft.com/2016/07/finding-hidden-haiku/">labs blog post</a>',
		"these help text haiku<br>can only be annoying<br>apologies due",
		"left and right arrows<br>lead to next haiku in group<br>or the previous",
		"many different groups<br>selected between arrows<br>via the drop down",
		"haiku grouped in themes<br>such as IMAGERY, CROP, MOOD<br>all in upper case",
		"haiku keyword groups<br>such as 'but', 'if', and others<br>all in lower case",
		"just for the record<br>instructions in haiku form<br>not worth the effort",
		"wandering freely<br>accepting of life's foibles<br>RANDOM takes you there",
		"simplicity calls<br>navigation unneeded<br>KIOSK tidies up",
		"your hands off the wheel<br>haiku flicking slowly past<br>choose greater than twice"
	];
	var explanationAuthor = 'Explanations of Haiku and App';

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

	// convert text into json and build up the haiku data structs
	// returns the count of haiku extracted

	function processJsonImpl(text) {
		var haikuData = JSON.parse(text);
		
		var count            = 0;
		var knownCoreThemes  = {};

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
				knownAuthorsHash[author] = true;
			};
			haikuListsByTheme[author].push(id);
		});

		Object.keys(knownCoreThemes).forEach(function(theme){
			if (haikuListsByTheme[theme].length > 1) {
				coreThemes.push(theme);
			};
		});

		coreThemes = coreThemes.sort();

		if (!(defaultTheme in haikuListsByTheme)) {
			defaultTheme = coreThemes[0] || Object.keys(haikuListsByTheme)[0];
		};

		Object.keys(knownAuthorsHash).forEach(function(author){
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

		return count;
	}

	// create special haiku, not from the main collection, e.g. 'explanation' haiku, 
	// differing in text but sharing all the other criteria such as author and date.
	// See default_spec for how to specify the new haiku, 
	// and any part(s) can be overridden in the optional param, detailed_spec.
	// theme should be a string
	// texts should be a list of strings

	function constructBespokeHaiku(theme, texts, detailed_spec={}){
		var default_spec = {
			"Author": theme,
			"Title": theme,
			"Url": "http://labs.ft.com/2016/07/finding-hidden-haiku/",
			"DateSelected": "2016-11-22",
		    "ImageUrl": "https://www.ft.com/__origami/service/image/v2/images/raw/http%3A%2F%2Fprod-upp-image-read.ft.com%2F69f10230-2272-11e6-aa98-db1e01fabc0c?source=next&fit=scale-down&compression=best&width=600",
		    "ImageWidth": 600,
		    "ImageHeight": 338,
		    "PromoImageUrl": "",
		    "PromoImageWidth": 0,
		    "PromoImageHeight": 0,
		    "NonPromoImageUrl": "",
		    "NonPromoImageWidth": 0,
		    "NonPromoImageHeight": 0,
			"Uuid": "4c9646fa-c534-11e5-b3b1-7b2481276e45",
			"PubDateString": "2016-03-04T10:42:39Z",
			"PubDateEpoch": 1457088159,
			"TextWithBreaks": theme,
			"Themes": [],
		    "ProminentColours": [
		      {
				"Name": "LightMuted",
				"Population": 1000,
				"RGBHex": "#fff1e0"
		      }
			],
			"ProminentColoursByName": {
				"LightMuted": {
			        "Name": "LightMuted",
			        "Population": 1000,
			        "RGBHex": "#fff1e0"
			    }
			},
			"Id": theme
		};

		if (!(theme in haikuListsByTheme)) {
			haikuListsByTheme[theme] = [];
		};

		var count = 0;
		texts.forEach(function(text){
			count = count + 1;
			var id = theme + count;
			var haiku = Object.assign(
					{}, 
					default_spec, 
					detailed_spec,
					{
						TextWithBreaks: text,
						Id:             id
					}
				);
			haikuById[id] = haiku;
			haikuById[id]['Themes'] = coreThemes.slice().sort();
			haikuById[id]['Themes'].unshift(theme);
			haikuListsByTheme[theme].push(id);
		});

		return count;
	}

	function getAndProcessJsonThen( thenFn ) {
		var oReq    = new XMLHttpRequest();
		oReq.onload = processJson;
		oReq.open("get", jsonUrl, true);
		oReq.send();

		function processJson(e) {
			if (this.status == 200) {
				var numHaiku = processJsonImpl(this.responseText);
				console.log('processJson: numHaiku=' + numHaiku);
				var numBespokeHaiku = constructBespokeHaiku(explanationTheme, explanations);
				console.log('processJson: for theme=' + explanationTheme + ', numBespokeHaiku=' + numBespokeHaiku);
			} else {
				console.log("Error: failed to retrive haiku: status=" + this.status);
			}

			thenFn();
		}
	}

	// given a haiku (by id) and a theme,
	// if the theme is invalid, use the default theme.
	// if the id is invalid, use the first haiku from the theme
	//    else lookup the index of the haiku in the them, and get the next haiku in the sequence, wrapping to first if at end of list
	function getNextDetails( id, theme, direction=1 ) {
		if (theme == explanationTheme) {
			// leave as is
		} else if ( knownAuthorsHash[theme] ) {
			// leave as is
		} else if ( ! okAsThemesHash[theme] ) {
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
		if (params.revealMode) {
			nextUrl = nextUrl + '&reveal=true';
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
		// } else if (t in okAuthorsHash) {
		// 	displayT = t;
		} else if (t.length > maxButtonTextLength) {
			displayT = t.substring(0,maxButtonTextLength) + '...';
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
		var nextIn          = urlParam('next-in');
		var kioskMode       = (urlParam('kiosk')       != null);
		var randomWalkMode  = (urlParam('randomwalk')  != null);
		var revealMode      = (urlParam('reveal')      != null);

		var haikuId = details['id'];
		var theme   = details['theme'];
		var haiku   = details['haiku'];

		var numThemes = haiku['Themes'].length;
		if (randomWalkMode && numThemes > 1) {
			theme = haiku['Themes'][Math.floor(Math.random() * numThemes)];
		};

		// set the card background color
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

		// insert the haiku text
		var textElt = getElementByClass("haiku-text");
		if (longestLineLength(haiku['TextWithBreaks']) > lineThreshold) {
			textElt.classList.add('haiku-too-long');
		} else {
			textElt.classList.remove('haiku-too-long');
		};
		textElt.innerHTML = haiku['TextWithBreaks'];

		// insert the img and link
		var imgElt = getElementByClass("haiku-image");
		imgElt.src = haiku['ImageUrl'];

		var imgLinkElt = getElementByClass("haiku-image-link");
		imgLinkElt.href = haiku['Url'];

		// insert the author
		var authorElt = getElementByClass("haiku-author");
		authorElt.innerHTML = haiku['Author'];

		// insert the article title
		var articleTitleLinkElt = getElementByClass("haiku-article-title-link");
		articleTitleLinkElt.href = haiku['Url'];
		articleTitleLinkElt.innerHTML = haiku['Title'];

		var articleTitleElt = getElementByClass("haiku-article-title");
		if (revealMode) {
			articleTitleElt.classList.remove('hide');
		} else {
			articleTitleElt.classList.add('hide');
		};

		// construct and insert the nav
		var footerElt = getElementByClass('haiku-footer');
		
		if (kioskMode) {
			footerElt.classList.add('hide');
			textElt.onclick = function(){
				kioskMode = false;
				footerElt.classList.remove('hide');
				textElt.onclick = null;
			};
		} else {	
			textElt.onclick = null;
			footerElt.classList.remove('hide');
		};

		var timeoutId;
		if (nextIn > 0) {
			var fnNextIn = function() {
				setPageUrlForNextHaiku({
					id: haikuId, 
					theme: theme, 
					direction: +1, 
					nextIn: nextIn,
					kioskMode: kioskMode,
					randomWalkMode: randomWalkMode,
					revealMode: revealMode
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
				randomWalkMode: randomWalkMode,
				revealMode: revealMode
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
				randomWalkMode: randomWalkMode,
				revealMode: revealMode
			});
			displayHaiku();
		};

		var fnNextAuto = function() {
			window.clearTimeout(timeoutId);
			setPageUrlForNextHaiku({
				id: haikuId, 
				theme: theme, 
				direction: (nextIn > 0)? 0 : -1,
				kioskMode: kioskMode,
				randomWalkMode: randomWalkMode,
				nextIn: (nextIn > 0) ? 0 : defaultNextIn,
				revealMode: revealMode
			});
			displayHaiku();
		};

		var fnNextKiosk = function() {
			window.clearTimeout(timeoutId);
			setPageUrlForNextHaiku({
				id: haikuId, 
				theme: theme, 
				direction: -1,
				kioskMode: true,
				randomWalkMode: randomWalkMode,
				nextIn: nextIn,
				revealMode: revealMode
			});
			displayHaiku();
		};

		var fnNextRandom = function() {
			window.clearTimeout(timeoutId);
			setPageUrlForNextHaiku({
				id: haikuId, 
				theme: theme, 
				direction: -1,
				kioskMode: kioskMode,
				randomWalkMode: ! randomWalkMode,
				nextIn: nextIn,
				revealMode: revealMode
			});
			displayHaiku();
		};

		var fnNextReveal = function() {
			window.clearTimeout(timeoutId);
			setPageUrlForNextHaiku({
				id: haikuId, 
				theme: theme, 
				direction: 0,
				kioskMode: kioskMode,
				randomWalkMode: randomWalkMode,
				nextIn: nextIn,
				revealMode: ! revealMode
			});
			displayHaiku();
		};

		var nextElt = getElementByClass("haiku-next");
		nextElt.onclick = fnPrev;

		var prevElt = getElementByClass("haiku-prev");
		prevElt.onclick = fnNext;

		var kioskElt = getElementByClass("haiku-kiosk");
		kioskElt.onclick = fnNextKiosk;

		var fnSetSelected = function(elt, selected) {
			if (selected) {
				elt.classList.add('selected');
			} else {
				elt.classList.remove('selected');
			};
		};

		var autoElt = getElementByClass("haiku-auto");
		autoElt.onclick = fnNextAuto;
		fnSetSelected(autoElt, (nextIn > 0) );

		var randomElt = getElementByClass("haiku-random");
		randomElt.onclick = fnNextRandom;
		fnSetSelected(randomElt, randomWalkMode);

		var revealElt = getElementByClass("haiku-reveal");
		revealElt.onclick = fnNextReveal;
		fnSetSelected(revealElt, revealMode);

		document.onkeydown = function() {
			switch (window.event.keyCode) {
				case 37: // left key
					fnPrev();
				break;
				case 38: // up key
					fnNextRandom();
				break;
				case 39: // right key
					fnNext();
				break;
				case 40: // down
					fnNextReveal();
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

		var onChangeFn = function(event) {
			var value = event.srcElement.value;
			console.log("onChangeFn: value=", value);

			var selectedTheme;
			var direction = -1;

			if (value == "THEME") {
				selectedTheme  = theme;
				direction      = 0;
			} else {
				selectedTheme  = value;
			};

			var fnSetPage = function() {
				setPageUrlForNextHaiku({
					id:             haikuId, 
					theme:          selectedTheme, 
					direction:      direction,
					kioskMode:      kioskMode,
					randomWalkMode: randomWalkMode,
					nextIn:         nextIn,
					revealMode:     revealMode
				});
			}

			fnSetPage();
			displayHaiku();
		};

		var selectElt = getElementByClass("haiku-themes-select");
		selectElt.options.length = 0;

		selectElt.options[selectElt.options.length] = new Option(calcButtonDisplayText(theme, haiku), theme);

		selectElt.options[selectElt.options.length] = new Option(explanationTheme,  explanationTheme);

		// append all core themes
		selectElt.options[selectElt.options.length] = new Option("--- THEMES ---", "THEME");
		coreThemes.forEach(function(ct){
			var isCandidateTheme = candidateThemes.includes(ct);
			var suffix = (isCandidateTheme)? " *" : "";
			var displayName = calcButtonDisplayText(ct, haiku) + suffix;
			selectElt.options[selectElt.options.length] = new Option(displayName, ct);
		});

		// append all the authors
		if (authorOptions.length == 0) {
			authorOptions.push( new Option("--- AUTHOR ---", haiku['Author']) );
			Object.keys(knownAuthorsHash).sort().forEach(function(author){
				var displayName = calcButtonDisplayText(author, haiku) + '(' + haikuListsByTheme[author].length + ')';
				
				authorOptions.push( new Option(displayName, author) );
			});
		};

		authorOptions.forEach(function(option){
			selectElt.options[selectElt.options.length] = option;
		});

		selectElt.selectedIndex = 0;

		selectElt.onchange = onChangeFn;

		selectElt.onclick  = function() { // deactivate nextIn if select is opened
			nextIn = 0;
			window.clearTimeout(timeoutId); 
		};
	}

	return {
		getAndProcessJsonThen:  getAndProcessJsonThen,
		displayHaiku: 			displayHaiku
	};

})();

window.onpopstate = Meditation.displayHaiku; // redraw page when back button is used

Meditation.getAndProcessJsonThen( Meditation.displayHaiku );
