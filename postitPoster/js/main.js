function init() {
	var mode = getQueryStringValue("type");

	var add = document.querySelector('.button__add');
	var snap = document.querySelector('.button__snap');
	var poster = document.getElementById('poster');

		add.addEventListener('click', addNote);
	if (mode === "kiosk") {
		document.documentElement.classList.add("kiosk");
		add.style.display = 'none';
		snap.style.display = 'none';
	} else {
		poster.style.height = window.innerWidth * 2 + 'px';	
		snap.addEventListener('click', snapPoster);
	}

	window.addEventListener('resize', handleResize);
}

function addNote() {
	var note = new Note();
}

function snapPoster() {
	var poster = document.getElementById('poster');

	var captureHeight = document.documentElement.scrollHeight;
	console.log(document.documentElement.scrollHeight);
	html2canvas(poster, {height: captureHeight, width: window.innerWidth}).then(canvas => {

		var image = document.createElement('a');

		image.setAttribute('href', canvas.toDataURL());
		image.setAttribute('target', '_blank');
		image.click();
	});
}

function dataURItoBlob(dataURI) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0)
        byteString = atob(dataURI.split(',')[1]);
    else
        byteString = unescape(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to a typed array
    var ia = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ia], {type:mimeString});
}

function handleResize(e) {
	var poster = document.getElementById('poster');
	if(!document.documentElement.classList.contains('kiosk')) {
		poster.style.height = window.innerWidth * 2 + 'px';	
	}

	var notes = document.querySelectorAll('.note');
	if (notes.length > 0) {
		Array.from(notes).forEach(note => {
			note.style.width = window.innerWidth * POSTER_RATIO + 'px';
			note.style.height = window.innerWidth * POSTER_RATIO * NOTE_RATIO + 'px';
		});
	}
}

function getQueryStringValue (key) {  
  return decodeURIComponent(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + encodeURIComponent(key).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));  
}  

document.addEventListener("DOMContentLoaded", init);